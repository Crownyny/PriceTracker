"""Node 1 — Input Sanitizer

Limpia errores estructurales antes de cualquier análisis:
- Normalización de strings (unicode, strip, doble espacio)
- Normalización de precio (float + moneda, con contexto de fuente)
- Normalización de availability
- Manejo de nulos (raw_title)
"""
import logging
import re
import unicodedata

from shared.model import ScrapingState

from ..state import NormalizationState
from .constants import AVAILABILITY_MAP, CURRENCY_MAP, SOURCE_DEFAULT_CURRENCY

logger = logging.getLogger(__name__)


async def input_sanitizer_node(state: NormalizationState) -> NormalizationState:
    """Limpia errores estructurales antes de cualquier análisis."""
    if state.get("error"):
        return state

    raw_fields = state.get("raw_fields") or {}

    # Manejo de nulos y validaciones estructurales críticas
    raw_title = raw_fields.get("raw_title")
    raw_price_str = str(raw_fields.get("raw_price", ""))
    raw_url = raw_fields.get("raw_url")

    if not raw_title:
        return {
            **state,
            "product_invalid": True,
            "error": "Missing raw_title",
            "outcome": ScrapingState.NORMALIZATION_FAILED,
        }
    
    # Validar que exista una URL (trazabilidad)
    if not raw_url:
         return {
            **state,
            "product_invalid": True,
            "error": "Missing raw_url",
            "outcome": ScrapingState.NORMALIZATION_FAILED,
        }

    # Normalización de strings
    sanitized: dict = {}
    for key, value in raw_fields.items():
        if isinstance(value, str):
            value = unicodedata.normalize("NFKC", value)
            value = value.strip()
            value = re.sub(r"\s+", " ", value)
            sanitized[key] = value
        else:
            sanitized[key] = value

    # Normalización de precio
    source_name = state.get("source_name", "")
    raw_currency_val = str(sanitized.get("raw_currency") or "").upper()
    
    # Determinar moneda inicial (prioridad: campo raw > currency map > default)
    inferred_currency = ""
    if raw_currency_val:
        inferred_currency = _normalize_currency(raw_currency_val)
    
    if not inferred_currency:
        # Intentar inferir del precio string si no vino en raw_currency
        _, detected_curr = _parse_price_full(raw_price_str, context_currency=None)
        if detected_curr:
            inferred_currency = detected_curr
    
    if not inferred_currency:
         inferred_currency = SOURCE_DEFAULT_CURRENCY.get(source_name, "COP")

    # Parsear precio usando la moneda inferida como contexto para separadores
    price_value, _ = _parse_price_full(
        raw_price_str, 
        context_currency=inferred_currency
    )

    # Validar precio positivo
    if price_value <= 0:
        return {
            **state,
            "product_invalid": True,
            "error": f"Invalid price extracted: {price_value} from '{raw_price_str}'",
            "outcome": ScrapingState.NORMALIZATION_FAILED,
        }
    
    sanitized["_parsed_price"] = price_value
    sanitized["_currency"] = inferred_currency

    # Normalización de availability
    sanitized["_availability"] = _map_availability(
        str(sanitized.get("raw_availability", ""))
    )

    return {**state, "sanitized_product": sanitized, "product_invalid": False}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_price_full(raw_price: str, context_currency: str = None) -> tuple[float, str]:
    """Devuelve (valor_float, moneda_detectada)."""
    currency = ""
    if not raw_price:
        return 0.0, currency

    lower = raw_price.lower()
    # Intentar primero prefijos específicos (más largos) para evitar que "$" capture todo
    for symbol, code in sorted(CURRENCY_MAP.items(), key=lambda x: -len(x[0])):
        if symbol in lower:
            currency = code
            break

    # Conservar solo dígitos, puntos y comas
    cleaned = re.sub(r"[^\d.,]", "", raw_price)
    if not cleaned:
        return 0.0, currency

    # Reglas específicas por moneda
    # Grupo de monedas que usan '.' como separador de miles y ',' como decimal
    thousands_dot_currencies = {"COP", "CLP", "ARS", "PYG", "UYU", "VEF", "IDR", "KRW", "JPY", "VND"}
    
    is_thousands_dot = context_currency in thousands_dot_currencies
    
    comma_count = cleaned.count(",")
    dot_count = cleaned.count(".")

    # Caso 1: Ambos separadores presentes
    # Ejemplo: 1.200,50 o 1,200.50
    if comma_count >= 1 and dot_count >= 1:
        last_comma = cleaned.rfind(",")
        last_dot = cleaned.rfind(".")
        
        if is_thousands_dot:
            # Esperamos 1.200,50 (Punto antes que coma)
            if last_dot < last_comma:
                # Formato correcto para la región: 1.200,50 -> 1200.50
                cleaned = cleaned.replace(".", "").replace(",", ".")
            else:
                # Formato invertido (US style) en moneda LATAM: 1,200.50 -> 1200.50
                cleaned = cleaned.replace(",", "")
        else:
            # Esperamos 1,200.50 (Coma antes que punto)
            if last_comma < last_dot:
                # Formato correcto US: 1,200.50 -> 1200.50
                cleaned = cleaned.replace(",", "")
            else:
                # Formato invertido (Eur style) en moneda US: 1.200,50 -> 1200.50
                cleaned = cleaned.replace(".", "").replace(",", ".")

    # Caso 2: Solo puntos
    # Ejemplo: 1.200 o 1.50
    elif dot_count > 0:
        if is_thousands_dot:
            # En COP/CLP, el punto es casi siempre miles.
            # Excepción rara: separar centavos con punto (1.500 bolivares fuertes?)
            # Asumimos miles siempre si hay más de un punto o si los dígitos finales son 3
            parts = cleaned.split(".")
            # Si el último grupo tiene 3 dígitos, es muy probable que sea miles (1.234)
            # Si tiene 2 dígitos (1.50), es ambiguo, pero en COP no se usan centavos así comúnmente en e-commerce
            # Mejor asumir miles para COP.
            cleaned = cleaned.replace(".", "")
        else:
            # En USD, el punto es decimal si solo hay uno (10.50)
            # Si hay más de uno (1.200.000) es miles estilo europeo
            if dot_count == 1:
                # USD 12.50 -> 12.50
                pass 
            else:
                # USD 1.200.500 -> 1200500
                cleaned = cleaned.replace(".", "")
    
    # Caso 3: Solo comas
    # Ejemplo: 1,200 o 1,50
    elif comma_count > 0:
        if is_thousands_dot:
            # En COP/CLP, el comportamiento varía según dígitos tras la coma:
            # - Exactamente 3 dígitos tras la última coma → coma es separador de miles
            #   Ej: "72,007" → 72007 | "1,200,300" → 1200300
            # - Distinto de 3 dígitos → coma es decimal
            #   Ej: "5,99" → 5.99 | "1,5" → 1.5
            if comma_count > 1:
                # Múltiples comas → todas son de miles (ej: 1,200,300)
                cleaned = cleaned.replace(",", "")
            else:
                parts = cleaned.split(",")
                if len(parts[1]) == 3:
                    # "72,007" → 72007
                    cleaned = cleaned.replace(",", "")
                else:
                    # "5,99" → 5.99
                    cleaned = cleaned.replace(",", ".")
        else:
            # En USD, la coma es miles.
            # 1,200 -> 1200
            cleaned = cleaned.replace(",", "")

    try:
        value = float(cleaned)
    except ValueError:
        return 0.0, currency

    # Sanity guard para concatenaciones erróneas del scraper
    if value > 999_999_999: # mil millones
        first_match = re.search(r"[\d]+(?:[.,]\d+)*", raw_price)
        if first_match and first_match.group() != cleaned:
             # Llamada recursiva con el primer match encontrado, esperando que sea más limpio
            sub_val, sub_curr = _parse_price_full(first_match.group(), context_currency)
            if sub_val > 0:
                return sub_val, currency or sub_curr

    return value, currency


def _normalize_currency(raw: str) -> str:
    key = raw.lower().strip()
    return CURRENCY_MAP.get(key, raw.upper().strip() or "USD")


def _map_availability(raw: str) -> str:
    key = raw.lower().strip()
    if not key:
        return "unknown"
    return AVAILABILITY_MAP.get(key, "unknown")
