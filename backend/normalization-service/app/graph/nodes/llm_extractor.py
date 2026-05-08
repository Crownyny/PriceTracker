"""Node 6 — LLM Attribute Extractor

Usa un LLM pequeño para extraer atributos cuando las heurísticas son insuficientes.
El prompt y los atributos a extraer se adaptan al dominio del producto detectado.

Para añadir un dominio nuevo: agrega una entrada en _DOMAIN_ATTRIBUTES.
"""
import json
import logging

from ..state import NormalizationState
from .helpers import detect_domain

logger = logging.getLogger(__name__)

# ── Atributos a extraer por dominio ───────────────────────────────────────────
# Siempre se incluyen: brand, color, condition, product_type (genéricos comunes).
# Para añadir un dominio: agrega una nueva clave con la lista de atributos extra.

_GENERIC_ATTRIBUTES: list[str] = ["brand", "color", "condition", "product_type"]

_DOMAIN_ATTRIBUTES: dict[str, list[str]] = {
    "electronics": ["product_line", "model", "storage", "memory", "network"],
    "fashion":     ["size", "material", "gender"],
    "kitchen":     ["model", "capacity", "power"],
    "home":        ["model", "dimensions", "material"],
    "jewelry":     ["material", "purity", "stone"],
    "accessories": ["material", "dimensions"],
    "sports":      ["size", "weight"],
    "beauty":      ["volume"],
    "toys":        ["age_range", "pieces"],
    "health":      ["dosage", "quantity"],
    "automotive":  ["model", "displacement", "power"],
    "stationery":  ["pages", "quantity"],
    "baby":        ["age_range"],
    "food":        ["weight", "volume", "servings"],
    "tools":       ["model", "power", "voltage", "speed"],
    "pet":         ["weight"],
    "games":       ["model", "storage", "network", "resolution"],
}


def make_llm_extractor_node(llm=None):
    """Factoría: extrae atributos con un LLM pequeño."""

    async def llm_extractor(state: NormalizationState) -> NormalizationState:
        if state.get("error"):
            return state

        if llm is None:
            return {**state, "llm_attributes": {}}

        std = state.get("standardized_product") or {}
        h = state.get("heuristic_attributes") or {}

        domain = detect_domain(std.get("category", ""))
        domain_attrs = _DOMAIN_ATTRIBUTES.get(domain, []) if domain else []
        attributes = _GENERIC_ATTRIBUTES + domain_attrs
        attributes_list = "\n".join(attributes)

        prompt = (
            "You are an information extraction system.\n\n"
            "Your task is to extract structured product attributes "
            "from noisy ecommerce titles.\n\n"
            "Rules:\n\n"
            "1. Do NOT invent attributes.\n"
            "2. Only extract information present in the text.\n"
            "3. Normalize units when possible.\n"
            "4. If an attribute is missing return null.\n\n"
            f"Extract the following attributes:\n\n"
            f"{attributes_list}\n\n"
            "Return JSON only.\n\n"
            f"TEXT:\n{std.get('title', '')}\n"
            f"{std.get('description', '')}\n"
            f"{std.get('category', '')}\n\n"
            f"HEURISTIC_HINTS:\n{json.dumps(h, default=str)}"
        )

        try:
            from langchain_core.messages import HumanMessage

            response = await llm.ainvoke([HumanMessage(content=prompt)])
            text = response.content.strip()

            if "```" in text:
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()

            attrs = json.loads(text)
            # qwen2 a veces devuelve una lista en lugar de un objeto
            if isinstance(attrs, list):
                attrs = attrs[0] if attrs else {}
            if not isinstance(attrs, dict):
                attrs = {}
            valid_keys = set(attributes)
            attrs = {k: v for k, v in attrs.items() if k in valid_keys}
            return {**state, "llm_attributes": attrs}

        except Exception as exc:
            logger.warning(
                "[%s] LLM attribute extraction failed (continuing without): %s",
                state.get("job_id"), exc,
            )
            return {**state, "llm_attributes": {}}

    return llm_extractor
