"""Node 2 — Field Standardizer

Convierte campos al esquema interno independiente de tienda.
"""
import html
from html.parser import HTMLParser
import re

from ..state import NormalizationState


_HTML_TAG_RE = re.compile(r"<\s*/?\s*[a-zA-Z][^>]*>")
_HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
_ESCAPED_TAG_RE = re.compile(r"&lt;\s*/?\s*[a-zA-Z][^&]*&gt;", re.IGNORECASE)


class _HTMLToTextParser(HTMLParser):
    """Parser tolerante para convertir HTML en texto plano legible."""

    _BLOCK_TAGS = {
        "p", "div", "section", "article", "header", "footer", "main",
        "ul", "ol", "li", "table", "tr", "td", "th", "tbody", "thead", "tfoot",
        "h1", "h2", "h3", "h4", "h5", "h6",
    }
    _SKIP_CONTENT_TAGS = {"script", "style", "noscript", "svg", "canvas"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:  # noqa: ANN001
        tag_l = tag.lower()
        if tag_l in self._SKIP_CONTENT_TAGS:
            self._skip_depth += 1
            return
        if self._skip_depth > 0:
            return
        if tag_l == "br" or tag_l in self._BLOCK_TAGS:
            self._parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        tag_l = tag.lower()
        if tag_l in self._SKIP_CONTENT_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1
            return
        if self._skip_depth > 0:
            return
        if tag_l in self._BLOCK_TAGS:
            self._parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0 and data:
            self._parts.append(data)

    def get_text(self) -> str:
        text = "".join(self._parts)
        return _normalize_whitespace(text)


def _normalize_whitespace(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _fully_unescape_html(text: str) -> str:
    """Aplica html.unescape varias veces para soportar HTML doble-escapado."""
    current = text
    for _ in range(3):
        unescaped = html.unescape(current)
        if unescaped == current:
            break
        current = unescaped
    return current


def _contains_html(text: str) -> bool:
    if not text:
        return False
    if _HTML_TAG_RE.search(text):
        return True
    if _ESCAPED_TAG_RE.search(text):
        return True
    if _HTML_COMMENT_RE.search(text):
        return True
    lowered = text.lower()
    return "<!doctype" in lowered


def _strip_tags_fallback(text: str) -> str:
    """Fallback defensivo si el parser no logra convertir correctamente."""
    text = re.sub(r"(?is)<\s*br\s*/?\s*>", "\n", text)
    text = re.sub(r"(?is)</\s*p\s*>", "\n", text)
    text = re.sub(r"(?is)<[^>]+>", " ", text)
    return _normalize_whitespace(text)


def _normalize_description(raw_description: str) -> str:
    """Convierte HTML (directo o escapado) a texto plano robusto."""
    if not raw_description:
        return ""

    if not isinstance(raw_description, str):
        raw_description = str(raw_description)

    raw_description = raw_description.strip()
    if not raw_description:
        return ""

    unescaped = _fully_unescape_html(raw_description)

    if not _contains_html(raw_description) and not _contains_html(unescaped):
        return _normalize_whitespace(unescaped)

    parser = _HTMLToTextParser()
    try:
        parser.feed(unescaped)
        parser.close()
        parsed = parser.get_text()
        if parsed:
            return parsed
    except Exception:
        pass

    return _strip_tags_fallback(unescaped)


async def field_standardizer_node(state: NormalizationState) -> NormalizationState:
    """Convierte campos al esquema interno independiente de tienda."""
    if state.get("error"):
        return state

    s = state.get("sanitized_product") or {}

    standardized = {
        "title": s.get("raw_title", ""),
        "price": s.get("_parsed_price", 0),
        "currency": s.get("_currency", "USD"),
        "availability": s.get("_availability", "in_stock"),
        "category": s.get("raw_category") or "",
        "image_url": s.get("raw_image_url", ""),
        "source_url": s.get("raw_url", ""),
        "description": _normalize_description(s.get("raw_description", "")),
        "source": state.get("source_name", ""),
    }

    return {**state, "standardized_product": standardized}
