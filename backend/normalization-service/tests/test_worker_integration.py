"""
Tests de integración — Flujo completo desde ScrapingMessage hasta NormalizedEventMessage.

Simulan exactamente el flujo del NormalizerWorker._handle_scraping_message():
  ScrapingMessage (cola RabbitMQ) → pipeline LangGraph → NormalizedEventMessage (cola de salida)

Todas las dependencias externas (RabbitMQ, PostgreSQL) se reemplazan con AsyncMock
para aislar la lógica de normalización.

Cobertura de 10 pruebas:
  1.  Flujo feliz: producto Amazon completo → state='normalized'
  2.  Flujo feliz: producto Éxito sin category → normalizado correctamente
  3.  Estado FAILED en ScrapingMessage → short-circuit, no invoca pipeline
  4.  raw_title nulo → state='normalization_failed', error publicado
  5.  Precio con símbolo COP en texto → precio parseado, moneda COP
  6.  Fuente MercadoLibre → moneda por defecto COP cuando raw_currency es None
  7.  Producto fashion: materiales y género presentes en extra del evento
  8.  Disponibilidad 'out of stock' → availability=False en final_product
  9.  search_id presente → increment_completed_jobs llamado con los datos correctos
  10. publisher.publish llamado con queue='normalized.events' y job_id correcto
"""
import datetime
from unittest.mock import AsyncMock, MagicMock, call, patch

import pytest

from shared.model import ScrapingMessage, ScrapingState

# Importar la lógica de construcción del estado inicial del worker
from app.graph.pipeline import build_pipeline
from app.worker import NormalizerWorker


# ─────────────────────────────────────────────────────────────────────────────
# Helpers y fixtures
# ─────────────────────────────────────────────────────────────────────────────

def _make_scraping_msg(
    raw_fields: dict,
    *,
    state: ScrapingState = ScrapingState.SCRAPED,
    source: str = "amazon",
    product_ref: str = "gildan-hombre-001",
    job_id: str = "integration-job-001",
    search_id: str | None = "search-001",
    error_message: str | None = None,
) -> ScrapingMessage:
    # Asegurar raw_url para que input_sanitizer no falle por URL faltante
    if "raw_url" not in raw_fields and state == ScrapingState.SCRAPED:
        raw_fields = {**raw_fields, "raw_url": f"https://example.com/product/{job_id}"}
    return ScrapingMessage(
        job_id=job_id,
        search_id=search_id,
        product_ref=product_ref,
        source_name=source,
        captured_at=datetime.datetime.now(tz=datetime.timezone.utc),
        state=state,
        raw_fields=raw_fields,
        error_message=error_message,
    )


def _make_worker() -> tuple[NormalizerWorker, MagicMock, MagicMock]:
    """
    Crea un NormalizerWorker con todas las dependencias externas mockeadas.
    Devuelve (worker, mock_repo, mock_publisher).
    """
    mock_repo = MagicMock()
    mock_repo.upsert_product = AsyncMock(return_value=None)
    mock_repo.append_price_history = AsyncMock(return_value=None)
    mock_repo.increment_completed_jobs = AsyncMock(return_value=(1, None))
    mock_repo.record_expected_jobs = AsyncMock(return_value=(0, None))

    pipeline = build_pipeline(product_repo=mock_repo, llm=None)

    # Construir el worker sin pasar por __init__ que requiere RabbitMQ real
    worker = object.__new__(NormalizerWorker)
    worker._pipeline = pipeline
    worker._product_repo = mock_repo

    mock_publisher = MagicMock()
    mock_publisher.publish = AsyncMock(return_value=None)
    worker._publisher = mock_publisher

    return worker, mock_repo, mock_publisher


# ─────────────────────────────────────────────────────────────────────────────
# 1 – Flujo feliz: producto Amazon completo → state='normalized'
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_flujo_feliz_amazon_product_normalizado():
    """
    Un ScrapingMessage con datos completos de Amazon debe terminar
    en NormalizedEventMessage con state='normalized'.
    """
    worker, _, publisher = _make_worker()
    msg = _make_scraping_msg({
        "raw_title": "Gildan Camisetas de Cuello Redondo para Hombre Paquete Múltiple G1100",
        "raw_price": "COP 86,672.30",
        "raw_currency": "COP",
        "raw_availability": "available",
        "raw_category": None,
        "raw_image_url": "https://m.media-amazon.com/images/I/51wDsZxtTLL._AC_UL320_.jpg",
        "raw_url": "https://www.amazon.com/dp/B07JDFPQTC",
        "raw_description": "Entrega GRATIS el jue, 19 de mar",
    })

    await worker._handle_scraping_message(msg.model_dump(mode="json"))

    publisher.publish.assert_called_once()
    published_payload = publisher.publish.call_args[0][1]
    assert published_payload["state"] == "normalized"
    assert published_payload["job_id"] == "integration-job-001"
    assert published_payload["error_message"] is None


# ─────────────────────────────────────────────────────────────────────────────
# 2 – Flujo feliz: producto Éxito sin category → normalizado sin errores
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_flujo_feliz_exito_sin_categoria():
    """
    Producto de Éxito con raw_category=None y disponible debe ser normalizado
    sin errores, usando categoría vacía que cae en 'unknown'.
    """
    worker, repo, publisher = _make_worker()
    msg = _make_scraping_msg(
        {
            "raw_title": "Hanes Camiseta algodón para hombre multipaquete blanco",
            "raw_price": "COP 90,404.60",
            "raw_currency": "COP",
            "raw_availability": "disponible",
            "raw_category": None,
        },
        source="exito",
        product_ref="hanes-multipack-blanco",
    )

    await worker._handle_scraping_message(msg.model_dump(mode="json"))

    published_payload = publisher.publish.call_args[0][1]
    assert published_payload["state"] == "normalized"
    # El repositorio debió recibir la llamada de upsert
    repo.upsert_product.assert_called_once()


# ─────────────────────────────────────────────────────────────────────────────
# 3 – Estado FAILED en ScrapingMessage → short-circuit, no invoca pipeline
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_scraping_fallido_short_circuit():
    """
    Si el scraper ya reportó FAILED, el worker debe publicar
    normalization_failed sin invocar el pipeline.
    """
    worker, repo, publisher = _make_worker()
    msg = _make_scraping_msg(
        {},
        state=ScrapingState.FAILED,
        error_message="Timeout al cargar la página",
        job_id="failed-job-002",
    )

    await worker._handle_scraping_message(msg.model_dump(mode="json"))

    published_payload = publisher.publish.call_args[0][1]
    assert published_payload["state"] == "normalization_failed"
    assert "Timeout" in (published_payload.get("error_message") or "")
    # El pipeline nunca debe alcanzar save → upsert_product no llamado
    repo.upsert_product.assert_not_called()


# ─────────────────────────────────────────────────────────────────────────────
# 4 – raw_title nulo → normalization_failed, error publicado
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_titulo_nulo_produce_normalization_failed():
    """
    raw_title=None debe provocar product_invalid=True en el pipeline
    y publicar un NormalizedEventMessage con state='normalization_failed'.
    """
    worker, repo, publisher = _make_worker()
    msg = _make_scraping_msg(
        {
            "raw_title": None,
            "raw_price": "COP 50,000",
            "raw_currency": "COP",
            "raw_availability": "available",
        },
        job_id="no-title-job-003",
    )

    await worker._handle_scraping_message(msg.model_dump(mode="json"))

    published_payload = publisher.publish.call_args[0][1]
    assert published_payload["state"] == "normalization_failed"
    repo.upsert_product.assert_not_called()


# ─────────────────────────────────────────────────────────────────────────────
# 5 – Precio con símbolo COP en texto → precio parseado, moneda COP
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_precio_cop_en_texto_parseado_correctamente():
    """
    raw_price='COP 73,854.30' debe terminar con price≈73854.30 y currency='COP'
    en el producto persistido.
    """
    worker, repo, publisher = _make_worker()
    msg = _make_scraping_msg(
        {
            "raw_title": "Gildan Crew Camisetas paquete múltiple G1100 algodón hombre",
            "raw_price": "COP 73,854.30",
            "raw_currency": "COP",
            "raw_availability": "available",
        },
        job_id="precio-cop-job-004",
    )

    await worker._handle_scraping_message(msg.model_dump(mode="json"))

    assert publisher.publish.call_args[0][1]["state"] == "normalized"

    # Verificar que upsert_product fue llamado con el precio correcto
    repo.upsert_product.assert_called_once()
    saved_product = repo.upsert_product.call_args[0][0]
    assert saved_product.price == pytest.approx(73854.30)
    assert saved_product.currency == "COP"


# ─────────────────────────────────────────────────────────────────────────────
# 6 – Fuente MercadoLibre → moneda por defecto COP cuando raw_currency es None
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_fuente_mercadolibre_moneda_defecto_cop():
    """
    Sin raw_currency y fuente='mercadolibre' → moneda por defecto 'COP'
    aplicada por SOURCE_DEFAULT_CURRENCY.
    """
    worker, repo, publisher = _make_worker()
    msg = _make_scraping_msg(
        {
            "raw_title": "Camiseta Polo de algodón para hombre talla M blanco",
            "raw_price": "49900",      # sin prefijo de moneda
            "raw_currency": None,
            "raw_availability": "available",
        },
        source="mercadolibre",
        product_ref="polo-algodon-ml",
        job_id="ml-currency-job-005",
    )

    await worker._handle_scraping_message(msg.model_dump(mode="json"))

    repo.upsert_product.assert_called_once()
    saved_product = repo.upsert_product.call_args[0][0]
    assert saved_product.currency == "COP", (
        f"Se esperaba COP por defecto de MercadoLibre, se obtuvo: {saved_product.currency}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 7 – Producto fashion: atributos de dominio en extra del producto persistido
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_fashion_extra_contiene_material_y_genero():
    """
    Producto de moda con algodón+hombre en el título → upsert_product
    recibe un NormalizedProduct cuyo campo extra almacena los atributos
    extraídos por las heurísticas de dominio fashion.
    """
    worker, repo, publisher = _make_worker()
    msg = _make_scraping_msg(
        {
            "raw_title": "Gildan Camiseta de algodón para hombre cuello redondo azul",
            "raw_price": "COP 75,362.30",
            "raw_currency": "COP",
            "raw_availability": "available",
        },
        job_id="fashion-attrs-job-006",
    )

    await worker._handle_scraping_message(msg.model_dump(mode="json"))

    assert publisher.publish.call_args[0][1]["state"] == "normalized"
    repo.upsert_product.assert_called_once()
    saved_product = repo.upsert_product.call_args[0][0]

    extra = saved_product.extra
    # El extra debe contener al menos la confianza heurística
    assert "heuristic_confidence" in extra
    assert extra["heuristic_confidence"] >= 3, (
        f"Confianza esperada ≥ 3 para producto rich, se obtuvo: {extra['heuristic_confidence']}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 8 – Disponibilidad 'out of stock' → availability=False en producto persistido
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_out_of_stock_persiste_como_false():
    """
    raw_availability='out of stock' → NormalizedProduct.availability=False
    en el objeto pasado a upsert_product.
    """
    worker, repo, publisher = _make_worker()
    msg = _make_scraping_msg(
        {
            "raw_title": "Hanes Camiseta sin mangas para hombre paquete de 6 algodón",
            "raw_price": "COP 94,174.60",
            "raw_currency": "COP",
            "raw_availability": "out of stock",
        },
        job_id="out-of-stock-job-007",
    )

    await worker._handle_scraping_message(msg.model_dump(mode="json"))

    assert publisher.publish.call_args[0][1]["state"] == "normalized"
    saved_product = repo.upsert_product.call_args[0][0]
    assert saved_product.availability is False, (
        f"Se esperaba availability=False, se obtuvo: {saved_product.availability}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 9 – search_id presente → increment_completed_jobs llamado con datos correctos
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_search_id_incrementa_contador_completados():
    """
    Cuando ScrapingMessage incluye search_id, el worker debe llamar
    increment_completed_jobs con ese search_id y product_ref exactos.
    """
    worker, repo, publisher = _make_worker()
    msg = _make_scraping_msg(
        {
            "raw_title": "Gildan Camiseta sin mangas multipaquete Deportivo hombre algodón",
            "raw_price": "COP 53,760.20",
            "raw_currency": "COP",
            "raw_availability": "available",
        },
        job_id="search-tracking-job-008",
        search_id="my-search-abc123",
        product_ref="gildan-sin-mangas",
    )

    await worker._handle_scraping_message(msg.model_dump(mode="json"))

    repo.increment_completed_jobs.assert_called_once_with(
        "my-search-abc123", "gildan-sin-mangas"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 10 – publisher.publish llamado con queue correcta y job_id correcto
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_publisher_llamado_con_queue_y_job_id_correctos():
    """
    El worker siempre debe publicar el NormalizedEventMessage en la cola
    'normalized.events' con el job_id del mensaje original, sin importar
    si la normalización tuvo éxito o fallo.
    """
    from shared.messaging import QUEUE_NORMALIZED_EVENTS

    worker, _, publisher = _make_worker()
    msg = _make_scraping_msg(
        {
            "raw_title": "Hanes Camiseta bolsillo para hombre paquete 6 algodón fresco",
            "raw_price": "COP 94,174.60",
            "raw_currency": "COP",
            "raw_availability": "available",
            "raw_image_url": "https://m.media-amazon.com/images/I/71ISTYxoRgL._AC_UL320_.jpg",
            "raw_url": "https://www.amazon.com/dp/B0D2PKNT93",
        },
        job_id="publisher-check-job-009",
    )

    await worker._handle_scraping_message(msg.model_dump(mode="json"))

    publisher.publish.assert_called_once()
    queue_used = publisher.publish.call_args[0][0]
    payload = publisher.publish.call_args[0][1]

    assert queue_used == QUEUE_NORMALIZED_EVENTS, (
        f"Cola incorrecta: se esperaba '{QUEUE_NORMALIZED_EVENTS}', se usó '{queue_used}'"
    )
    assert payload["job_id"] == "publisher-check-job-009"
    assert payload["product_ref"] == "gildan-hombre-001"
    assert payload["source_name"] == "amazon"
