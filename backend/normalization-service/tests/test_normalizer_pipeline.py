"""
Pruebas unitarias del pipeline de normalización.

Validan heurísticas y flujo completo sin LLM ni base de datos real.
El ProductRepository se mockea con AsyncMock para evitar I/O.

Cobertura de 20 pruebas:
  - Parseo de precios (4 formatos + precio nulo)
  - Validación de título (nulo / vacío)
  - Disponibilidad (available / agotado)
  - Normalización de moneda (explícita, símbolo, default por fuente)
  - Heurísticas de atributos (marca, material, género)
  - Routing de calidad (confianza alta salta LLM / confianza baja activa merger)
  - Pipeline completo (product dict final, canonical_name, image_url, source_url)
"""
import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.graph.pipeline import build_pipeline


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _mock_repo() -> MagicMock:
    """Repositorio falso que acepta llamadas async sin efectos secundarios."""
    repo = MagicMock()
    repo.upsert_product = AsyncMock(return_value=None)
    repo.append_price_history = AsyncMock(return_value=None)
    return repo


def _initial_state(
    raw_fields: dict,
    *,
    source: str = "amazon",
    product_ref: str = "camiseta-001",
    job_id: str = "test-job-001",
) -> dict:
    """Construye el estado inicial mínimo requerido por el pipeline."""
    # Asegurar raw_url para que input_sanitizer no falle por URL faltante
    if "raw_url" not in raw_fields or raw_fields.get("raw_url") is None:
        raw_fields = {**raw_fields, "raw_url": "https://example.com/product/test"}
    return {
        "job_id": job_id,
        "product_ref": product_ref,
        "source_name": source,
        "captured_at": datetime.datetime.now(tz=datetime.timezone.utc).isoformat(),
        "raw_fields": raw_fields,
        "validation_errors": [],
        "outcome": "",
    }


@pytest.fixture
def pipeline():
    """Pipeline compilado sin LLM ni base de datos real."""
    return build_pipeline(product_repo=_mock_repo(), llm=None)


# ─────────────────────────────────────────────────────────────────────────────
# 1 – Precio: formato COP simple (coma = separador de miles)
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_precio_cop_formato_simple(pipeline):
    """'COP 72,007' debe parsearse como 72007.0 (coma = miles colombiano)."""
    state = _initial_state({
        "raw_title": "Gildan Camisetas de Cuello Redondo para Hombre",
        "raw_price": "COP 72,007",
        "raw_currency": "COP",
        "raw_availability": "available",
    })
    result = await pipeline.ainvoke(state)

    assert result["final_product"]["price"] == 72007.0


# ─────────────────────────────────────────────────────────────────────────────
# 2 – Precio: COP con decimales
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_precio_cop_con_decimales(pipeline):
    """'COP 73,854.30' debe parsearse como 73854.30."""
    state = _initial_state({
        "raw_title": "Gildan Camisetas Cuello Redondo Paquete Múltiple G1100",
        "raw_price": "COP 73,854.30",
        "raw_currency": "COP",
        "raw_availability": "available",
    })
    result = await pipeline.ainvoke(state)

    assert result["final_product"]["price"] == pytest.approx(73854.30)


# ─────────────────────────────────────────────────────────────────────────────
# 3 – Precio: múltiples puntos como separadores de miles (estilo colombiano)
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_precio_multiples_puntos_como_miles(pipeline):
    """'$1.999.000' debe parsearse como 1999000.0 (todos los puntos son miles)."""
    state = _initial_state({
        "raw_title": "Camiseta Gildan Cuello Redondo Hombre algodón",
        "raw_price": "$1.999.000",
        "raw_currency": "COP",
        "raw_availability": "available",
    })
    result = await pipeline.ainvoke(state)

    assert result["final_product"]["price"] == 1999000.0


# ─────────────────────────────────────────────────────────────────────────────
# 4 – Precio: formato europeo (punto = miles, coma = decimal)
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_precio_formato_europeo(pipeline):
    """'1.999,00' (formato europeo) debe parsearse como 1999.0."""
    state = _initial_state({
        "raw_title": "Camiseta Hanes algodón para hombre unisex",
        "raw_price": "1.999,00",
        "raw_currency": "EUR",
        "raw_availability": "available",
        "raw_url": "https://example.com/product/1",
    })
    result = await pipeline.ainvoke(state)

    assert result["final_product"]["price"] == pytest.approx(1999.0)


# ─────────────────────────────────────────────────────────────────────────────
# 5 – Precio nulo produce fallo de validación
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_precio_nulo_falla_validacion(pipeline):
    """precio=None → price=0 → ProductValidator lanza error → normalization_failed."""
    state = _initial_state({
        "raw_title": "Hanes Camiseta algodón para hombre multipaquete",
        "raw_price": None,
        "raw_currency": "USD",
        "raw_availability": "available",
    })
    result = await pipeline.ainvoke(state)

    assert result.get("outcome") == "normalization_failed"
    assert result.get("final_product") is None


# ─────────────────────────────────────────────────────────────────────────────
# 6 – Título nulo invalida el producto
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_titulo_nulo_invalida_producto(pipeline):
    """raw_title=None → product_invalid=True, pipeline termina en error_end."""
    state = _initial_state({
        "raw_title": None,
        "raw_price": "COP 50,000",
        "raw_currency": "COP",
        "raw_availability": "available",
    })
    result = await pipeline.ainvoke(state)

    assert result.get("product_invalid") is True
    assert result.get("outcome") == "normalization_failed"


# ─────────────────────────────────────────────────────────────────────────────
# 7 – Título vacío invalida el producto
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_titulo_vacio_invalida_producto(pipeline):
    """raw_title='' (string vacío) → product_invalid=True."""
    state = _initial_state({
        "raw_title": "",
        "raw_price": "COP 60,000",
        "raw_currency": "COP",
        "raw_availability": "available",
    })
    result = await pipeline.ainvoke(state)

    assert result.get("product_invalid") is True
    assert result.get("outcome") == "normalization_failed"


# ─────────────────────────────────────────────────────────────────────────────
# 8 – Disponibilidad: 'available' → True
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_availability_available_es_true(pipeline):
    """'available' debe mapearse a availability=True en el producto final."""
    state = _initial_state({
        "raw_title": "Gildan Camiseta Cuello Redondo para Hombre",
        "raw_price": "COP 72,007",
        "raw_currency": "COP",
        "raw_availability": "available",
    })
    result = await pipeline.ainvoke(state)

    assert result["final_product"]["availability"] is True


# ─────────────────────────────────────────────────────────────────────────────
# 9 – Disponibilidad: 'agotado' → False
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_availability_agotado_es_false(pipeline):
    """'agotado' debe mapearse a availability=False en el producto final."""
    state = _initial_state({
        "raw_title": "Gildan Camiseta sin mangas para hombre multipaquete algodón",
        "raw_price": "COP 53,760",
        "raw_currency": "COP",
        "raw_availability": "agotado",
    })
    result = await pipeline.ainvoke(state)

    assert result["final_product"]["availability"] is False


# ─────────────────────────────────────────────────────────────────────────────
# 10 – Moneda: 'COP' explícito se preserva
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_moneda_cop_normalizada(pipeline):
    """raw_currency='COP' → final_product['currency']='COP'."""
    state = _initial_state({
        "raw_title": "Hanes Camiseta con bolsillo para hombre paquete de 6",
        "raw_price": "COP 94,174.60",
        "raw_currency": "COP",
        "raw_availability": "available",
    })
    result = await pipeline.ainvoke(state)

    assert result["final_product"]["currency"] == "COP"


# ─────────────────────────────────────────────────────────────────────────────
# 11 – Moneda: símbolo 'col$' se normaliza a 'COP'
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_moneda_col_dollar_normalizada_a_cop(pipeline):
    """raw_currency='col$' debe normalizarse al código ISO 4217 'COP'."""
    state = _initial_state({
        "raw_title": "Camiseta Gildan algodón para hombre talla L",
        "raw_price": "86,672",
        "raw_currency": "col$",
        "raw_availability": "available",
    })
    result = await pipeline.ainvoke(state)

    assert result["final_product"]["currency"] == "COP"


# ─────────────────────────────────────────────────────────────────────────────
# 12 – Moneda por defecto según fuente: éxito → COP
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_moneda_defecto_fuente_exito(pipeline):
    """Sin raw_currency y fuente='exito' → moneda por defecto es 'COP'."""
    state = _initial_state(
        {
            "raw_title": "Camiseta para hombre de algodón blanca",
            "raw_price": "49900",          # sin prefijo de moneda
            "raw_currency": None,
            "raw_availability": "disponible",
        },
        source="exito",
    )
    result = await pipeline.ainvoke(state)

    assert result["final_product"]["currency"] == "COP"


# ─────────────────────────────────────────────────────────────────────────────
# 13 – Heurística: marca Gildan detectada
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_marca_gildan_detectada_en_heuristicas(pipeline):
    """'Gildan' en el título → brand_candidates contiene 'gildan'."""
    state = _initial_state({
        "raw_title": "Gildan Camisetas de Cuello Redondo para Hombre Paquete Múltiple",
        "raw_price": "COP 75,362.30",
        "raw_currency": "COP",
        "raw_availability": "available",
    })
    result = await pipeline.ainvoke(state)

    brand_candidates = result.get("heuristic_attributes", {}).get("brand_candidates", [])
    assert "gildan" in brand_candidates


# ─────────────────────────────────────────────────────────────────────────────
# 14 – Heurística: marca Hanes detectada
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_marca_hanes_detectada_en_heuristicas(pipeline):
    """'Hanes' en el título → brand_candidates contiene 'hanes'."""
    state = _initial_state({
        "raw_title": "Hanes Paquetes de camisetas interiores para hombre algodón suave",
        "raw_price": "COP 90,404.60",
        "raw_currency": "COP",
        "raw_availability": "available",
    })
    result = await pipeline.ainvoke(state)

    brand_candidates = result.get("heuristic_attributes", {}).get("brand_candidates", [])
    assert "hanes" in brand_candidates


# ─────────────────────────────────────────────────────────────────────────────
# 15 – Heurística: material algodón detectado (dominio fashion)
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_material_algodon_detectado(pipeline):
    """'algodón' en el título de una camiseta → material_candidates no vacío."""
    state = _initial_state({
        "raw_title": "Hanes Camiseta interior de algodón suave para hombre",
        "raw_price": "COP 85,000",
        "raw_currency": "COP",
        "raw_availability": "available",
    })
    result = await pipeline.ainvoke(state)

    material_candidates = result.get("heuristic_attributes", {}).get("material_candidates", [])
    assert len(material_candidates) > 0
    # Verificar que algodón (normalizado a unicode) está presente
    assert any("algod" in m.lower() for m in material_candidates)


# ─────────────────────────────────────────────────────────────────────────────
# 16 – Heurística: género 'hombre' detectado (dominio fashion)
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_genero_hombre_detectado(pipeline):
    """'para Hombre' en el título → gender_candidates contiene 'hombre'."""
    state = _initial_state({
        "raw_title": "Gildan Camisetas de Cuello Redondo para Hombre Paquete",
        "raw_price": "COP 86,672.30",
        "raw_currency": "COP",
        "raw_availability": "available",
    })
    result = await pipeline.ainvoke(state)

    gender_candidates = result.get("heuristic_attributes", {}).get("gender_candidates", [])
    assert len(gender_candidates) > 0
    assert "hombre" in [g.lower() for g in gender_candidates]


# ─────────────────────────────────────────────────────────────────────────────
# 17 – Routing: confianza alta (≥3) salta el nodo LLM
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_confianza_alta_salta_llm(pipeline):
    """
    Título con marca + material + género → heuristic_confidence ≥ 3.
    El pipeline salta llm_extractor, por lo que llm_attributes debe ser None.
    """
    state = _initial_state({
        # Marca conocida (gildan) + material (algodón) + género (hombre): 3 campos
        "raw_title": "Gildan Camiseta de algodón para Hombre talla M",
        "raw_price": "COP 72,007",
        "raw_currency": "COP",
        "raw_availability": "available",
    })
    result = await pipeline.ainvoke(state)

    confidence = result.get("heuristic_confidence", 0)
    llm_attrs = result.get("llm_attributes")

    assert confidence >= 3, f"Se esperaba confianza ≥ 3, se obtuvo {confidence}"
    # Cuando se salta el LLM, llm_attributes nunca se setea
    assert llm_attrs is None, "llm_attributes debería ser None cuando se salta el nodo LLM"


# ─────────────────────────────────────────────────────────────────────────────
# 18 – Routing: confianza baja (<3) activa llm_extractor (fallback determinista)
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_confianza_baja_activa_merger(pipeline):
    """
    Título sin marca conocida ni atributos específicos → heuristic_confidence < 3.
    Con llm=None el extractor retorna {}, por lo que llm_attributes = {}.
    """
    state = _initial_state({
        # Ninguna marca conocida, sin material ni género explícito
        "raw_title": "Camiseta lisa de temporada variedad colores surtidos",
        "raw_price": "COP 35,000",
        "raw_currency": "COP",
        "raw_availability": "available",
    })
    result = await pipeline.ainvoke(state)

    confidence = result.get("heuristic_confidence", 0)
    llm_attrs = result.get("llm_attributes")

    assert confidence < 3, f"Se esperaba confianza < 3, se obtuvo {confidence}"
    # Con llm=None el nodo llm_extractor popula llm_attributes con {}
    assert llm_attrs == {}, f"llm_attributes debería ser {{}} (llm=None), se obtuvo {llm_attrs}"


# ─────────────────────────────────────────────────────────────────────────────
# 19 – Pipeline completo: canonical_name incluye la marca conocida
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_canonical_name_incluye_marca_gildan(pipeline):
    """
    Para un producto Gildan con confianza alta, el canonical_name
    del producto final debe contener 'gildan'.
    """
    state = _initial_state({
        "raw_title": "Gildan Camiseta de algodón para Hombre Paquete Múltiple",
        "raw_price": "COP 77,586.60",
        "raw_currency": "COP",
        "raw_availability": "available",
        "raw_image_url": "https://m.media-amazon.com/images/I/81ItG4mkmHS._AC_UL320_.jpg",
        "raw_url": "https://www.amazon.com/dp/B09312N4RH",
    })
    result = await pipeline.ainvoke(state)

    canonical = result["final_product"]["canonical_name"]
    assert "gildan" in canonical.lower(), (
        f"Se esperaba 'gildan' en canonical_name, se obtuvo: '{canonical}'"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 20 – Pipeline completo: tous champs du produit final présents
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_pipeline_producto_completo_todos_los_campos(pipeline):
    """
    Un producto Gildan real del JSON de Amazon debe producir un final_product
    con todos los campos obligatorios del modelo NormalizedProduct.
    """
    state = _initial_state(
        {
            "raw_title": "Gildan Camisetas de Cuello Redondo para Hombre Paquete Múltiple Estilo G1100",
            "raw_price": "COP 86,672.30",
            "raw_currency": "COP",
            "raw_availability": "available",
            "raw_category": None,
            "raw_image_url": "https://m.media-amazon.com/images/I/51wDsZxtTLL._AC_UL320_.jpg",
            "raw_description": "Entrega GRATIS el jue, 19 de mar",
            "raw_url": "https://www.amazon.com/-/es/Gildan-Camisetas/dp/B07JDFPQTC",
        },
        source="amazon",
        product_ref="gildan-g1100-hombre",
    )
    result = await pipeline.ainvoke(state)

    assert result.get("outcome") == "normalized", (
        f"Se esperaba outcome='normalized', se obtuvo '{result.get('outcome')}'. "
        f"Errores: {result.get('validation_errors')} / {result.get('error')}"
    )

    fp = result["final_product"]
    required_fields = [
        "product_ref", "source_name", "canonical_name",
        "price", "currency", "category", "availability",
        "updated_at",
    ]
    for field in required_fields:
        assert field in fp and fp[field] is not None, (
            f"Campo '{field}' ausente o nulo en final_product"
        )

    # Valores específicos del producto real
    assert fp["price"] == pytest.approx(86672.30)
    assert fp["currency"] == "COP"
    assert fp["availability"] is True
    assert fp["product_ref"] == "gildan-g1100-hombre"
    assert fp["source_name"] == "amazon"
    assert fp["image_url"] == "https://m.media-amazon.com/images/I/51wDsZxtTLL._AC_UL320_.jpg"
    assert fp["source_url"] == "https://www.amazon.com/-/es/Gildan-Camisetas/dp/B07JDFPQTC"
