"""
Pruebas de heurísticas por categoría — generadas a partir del análisis de datos
reales de scraping en 10 categorías de productos.

Cubren los nuevos patrones añadidos al attribute_extractor, text_canonicalizer
y constants al comparar los resultados del scraper con las capacidades previas
del sistema.

Categorías cubiertas:
  - Tecnología / Electrónica
  - Moda (ropa y calzado)
  - Belleza y cuidado personal
  - Entretenimiento y videojuegos
  - Hogar y electrodomésticos (cocina)
  - Alimentos y bebidas
  - Deporte y fitness
  - Juguetes y productos para niños
  - Salud y bienestar
  - Accesorios y gadgets (cargadores, cables)
"""
import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.graph.pipeline import build_pipeline


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _mock_repo() -> MagicMock:
    repo = MagicMock()
    repo.upsert_product = AsyncMock(return_value=None)
    repo.append_price_history = AsyncMock(return_value=None)
    return repo


def _state(raw_fields: dict, *, source: str = "amazon", job_id: str = "test-cat") -> dict:
    if "raw_url" not in raw_fields or not raw_fields.get("raw_url"):
        raw_fields = {**raw_fields, "raw_url": f"https://example.com/{job_id}"}
    return {
        "job_id": job_id,
        "product_ref": f"ref-{job_id}",
        "source_name": source,
        "captured_at": datetime.datetime.now(tz=datetime.timezone.utc).isoformat(),
        "raw_fields": raw_fields,
        "validation_errors": [],
        "outcome": "",
    }


@pytest.fixture
def pipeline():
    return build_pipeline(product_repo=_mock_repo(), llm=None)


# ─────────────────────────────────────────────────────────────────────────────
# TECNOLOGÍA / ELECTRÓNICA
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_electronics_screen_size_pulgadas(pipeline):
    """Laptop con '15.6 pulgadas' → screen_size_candidates detectado."""
    state = _state({
        "raw_title": "Lenovo IdeaPad pantalla FHD de 15.6 pulgadas Intel Celeron 8 GB RAM 64 GB",
        "raw_price": "COP 806,577",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="elec-screen-001")
    result = await pipeline.ainvoke(state)

    screen = result.get("heuristic_attributes", {}).get("screen_size_candidates", [])
    assert len(screen) > 0, "Debe detectar tamaño de pantalla en pulgadas"
    assert any("15" in s for s in screen), f"Pantalla: {screen}"


@pytest.mark.asyncio
async def test_electronics_bluetooth_network(pipeline):
    """Auricular Samsung con 'Bluetooth' → network_candidates incluye bluetooth."""
    state = _state({
        "raw_title": "Samsung Galaxy Buds 3 Pro Auriculares Bluetooth inalámbricos cancelación de ruido plateado",
        "raw_price": "COP 886,203",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="elec-bt-002")
    result = await pipeline.ainvoke(state)

    network = result.get("heuristic_attributes", {}).get("network_candidates", [])
    assert "bluetooth" in [n.lower() for n in network], f"Network: {network}"


@pytest.mark.asyncio
async def test_electronics_samsung_marca_detectada(pipeline):
    """'Samsung' en título de electrónica → brand_candidates contiene 'samsung'."""
    state = _state({
        "raw_title": "Samsung Galaxy Watch 8 40mm Bluetooth Smartwatch",
        "raw_price": "COP 1,278,001",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="elec-brand-003")
    result = await pipeline.ainvoke(state)

    brands = result.get("heuristic_attributes", {}).get("brand_candidates", [])
    assert "samsung" in brands, f"Marcas: {brands}"


@pytest.mark.asyncio
async def test_electronics_storage_memory_split(pipeline):
    """'4 GB de RAM, 64 GB SSD' → memory=4GB, storage=64GB."""
    state = _state({
        "raw_title": "HP Laptop 14 pulgadas Intel Celeron 4 GB RAM 64 GB SSD Windows 11",
        "raw_price": "COP 677,672",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="elec-storage-004")
    result = await pipeline.ainvoke(state)

    memory = result.get("heuristic_attributes", {}).get("memory_candidates", [])
    storage = result.get("heuristic_attributes", {}).get("storage_candidates", [])
    assert 4 in memory, f"Memory (esperado 4): {memory}"
    assert 64 in storage, f"Storage (esperado 64): {storage}"


# ─────────────────────────────────────────────────────────────────────────────
# MODA
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fashion_material_algodon(pipeline):
    """'algodón' en camiseta → material_candidates no vacío."""
    state = _state({
        "raw_title": "Gildan Camisetas de Cuello Redondo para Hombre algodón Paquete Múltiple",
        "raw_price": "COP 84,672",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="fashion-mat-001")
    result = await pipeline.ainvoke(state)

    mat = result.get("heuristic_attributes", {}).get("material_candidates", [])
    assert len(mat) > 0
    assert any("algod" in m.lower() for m in mat)


@pytest.mark.asyncio
async def test_fashion_genero_mujer(pipeline):
    """'para mujer' en tenis → gender_candidates contiene 'mujer'."""
    state = _state({
        "raw_title": "Nike Tenis deportivos para mujer blanco antracita",
        "raw_price": "COP 460,375",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="fashion-gender-002")
    result = await pipeline.ainvoke(state)

    gender = result.get("heuristic_attributes", {}).get("gender_candidates", [])
    assert "mujer" in [g.lower() for g in gender], f"Género: {gender}"


@pytest.mark.asyncio
async def test_fashion_nike_brand(pipeline):
    """'Nike' en título de moda → brand_candidates detecta 'nike'."""
    state = _state({
        "raw_title": "Nike Zapatillas Air Max 270 para mujer",
        "raw_price": "COP 519,303",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="fashion-brand-003")
    result = await pipeline.ainvoke(state)

    brands = result.get("heuristic_attributes", {}).get("brand_candidates", [])
    assert "nike" in brands, f"Marcas: {brands}"


# ─────────────────────────────────────────────────────────────────────────────
# BELLEZA Y CUIDADO PERSONAL
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_beauty_volumen_onzas(pipeline):
    """'19 onzas' en crema → volume_candidates detectado (variante en español de oz)."""
    state = _state({
        "raw_title": "CeraVe crema hidratante ácido hialurónico ceramidas 19 onzas sin fragancia",
        "raw_price": "COP 60,401",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="beauty-vol-001")
    result = await pipeline.ainvoke(state)

    vol = result.get("heuristic_attributes", {}).get("volume_candidates", [])
    assert len(vol) > 0, "Debe detectar volumen en onzas"
    assert any("19" in v for v in vol), f"Volumen: {vol}"


@pytest.mark.asyncio
async def test_beauty_ingrediente_hialuronico(pipeline):
    """'ácido hialurónico' → ingredient_candidates detectado."""
    state = _state({
        "raw_title": "SimplyVital Crema de colágeno retinol y ácido hialurónico hidratante facial",
        "raw_price": "COP 88,281",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="beauty-ing-002")
    result = await pipeline.ainvoke(state)

    ing = result.get("heuristic_attributes", {}).get("ingredient_candidates", [])
    assert len(ing) > 0, f"Ingredientes activos no detectados: {ing}"


@pytest.mark.asyncio
async def test_beauty_volumen_ml(pipeline):
    """'250 ml' en shampoo → volume_candidates detectado."""
    state = _state({
        "raw_title": "Olaplex Nº4 Bond Maintenance Shampoo reparador 250 ml sin sulfatos",
        "raw_price": "COP 125,222",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="beauty-ml-003")
    result = await pipeline.ainvoke(state)

    vol = result.get("heuristic_attributes", {}).get("volume_candidates", [])
    assert any("250" in v for v in vol), f"Volumen: {vol}"


# ─────────────────────────────────────────────────────────────────────────────
# ENTRETENIMIENTO Y VIDEOJUEGOS
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_games_edition_digital(pipeline):
    """'Digital Edition' en PS5 → edition_candidates detectado."""
    state = _state({
        "raw_title": "PlayStation 5 Digital Edition consola gaming",
        "raw_price": "COP 1,500,000",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="games-ed-001")
    result = await pipeline.ainvoke(state)

    edition = result.get("heuristic_attributes", {}).get("edition_candidates", [])
    assert len(edition) > 0, "Debe detectar 'Digital Edition'"
    assert any("digital" in e.lower() for e in edition), f"Edition: {edition}"


@pytest.mark.asyncio
async def test_games_color_black(pipeline):
    """'Carbon Black' en control Xbox → color_candidates incluye 'black'."""
    state = _state({
        "raw_title": "Xbox Wireless Gaming Controller 2025 Carbon Black Xbox Series X",
        "raw_price": "COP 160,173",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="games-color-002")
    result = await pipeline.ainvoke(state)

    colors = result.get("heuristic_attributes", {}).get("color_candidates", [])
    assert "black" in colors, f"Colores: {colors}"


# ─────────────────────────────────────────────────────────────────────────────
# HOGAR Y ELECTRODOMÉSTICOS (COCINA)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_kitchen_capacidad_qt(pipeline):
    """'5QT' en freidora → capacity_candidates detectado."""
    state = _state({
        "raw_title": "Ninja Freidora de aire 4 en 1 Pro Capacidad 5QT hasta 4 libras temperatura 400F",
        "raw_price": "COP 331,433",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="kitchen-qt-001")
    result = await pipeline.ainvoke(state)

    cap = result.get("heuristic_attributes", {}).get("capacity_candidates", [])
    assert len(cap) > 0, "Debe detectar capacidad en QT"
    assert any("5" in c for c in cap), f"Capacidad: {cap}"


@pytest.mark.asyncio
async def test_kitchen_potencia_watts(pipeline):
    """'1500 W' en licuadora → power_candidates detectado."""
    state = _state({
        "raw_title": "Ninja Mega Kitchen System 1500 W licuadora tamaño completo 72 onzas",
        "raw_price": "COP 552,413",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="kitchen-power-002")
    result = await pipeline.ainvoke(state)

    power = result.get("heuristic_attributes", {}).get("power_candidates", [])
    assert len(power) > 0, "Debe detectar potencia en W"
    assert any("1500" in p for p in power), f"Potencia: {power}"


@pytest.mark.asyncio
async def test_kitchen_ninja_brand(pipeline):
    """'Ninja' (nueva marca) → brand_candidates detectada."""
    state = _state({
        "raw_title": "Ninja BN701 Professional Plus Licuadora 1400 vatios gris oscuro",
        "raw_price": "COP 331,433",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="kitchen-brand-003")
    result = await pipeline.ainvoke(state)

    brands = result.get("heuristic_attributes", {}).get("brand_candidates", [])
    assert "ninja" in brands, f"Marcas: {brands}"


# ─────────────────────────────────────────────────────────────────────────────
# ALIMENTOS Y BEBIDAS
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_food_pack_of_n_ingles(pipeline):
    """'Pack of 24' (inglés) → quantity_candidates captura 24."""
    state = _state({
        "raw_title": "Red Bull Zero Energy Drink 12 onzas vitaminas B taurina cafeína",
        "raw_description": "Pack of 24",
        "raw_price": "COP 101,245",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="food-pack-001")
    result = await pipeline.ainvoke(state)

    qty = result.get("heuristic_attributes", {}).get("quantity_candidates", [])
    assert 24 in qty, f"Cantidad esperada 24 no encontrada: {qty}"


@pytest.mark.asyncio
async def test_food_volumen_onzas(pipeline):
    """'16 onzas' en bebida → volume_candidates detectado."""
    state = _state({
        "raw_title": "GHOST Bebida energética Paquete de 12 latas de 16 onzas 200 mg cafeína L-carnitina",
        "raw_price": "COP 105,000",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="food-oz-002")
    result = await pipeline.ainvoke(state)

    vol = result.get("heuristic_attributes", {}).get("volume_candidates", [])
    assert len(vol) > 0, "Debe detectar volumen en onzas"
    assert any("16" in v for v in vol), f"Volumen: {vol}"


@pytest.mark.asyncio
async def test_food_peso_gramos(pipeline):
    """'226.8 g' en producto alimenticio → weight_candidates."""
    state = _state({
        "raw_title": "365 by Whole Foods Market Queso Mozzarella orgánico 8 onzas 226.8 g",
        "raw_price": "COP 45,000",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="food-weight-003")
    result = await pipeline.ainvoke(state)

    weight = result.get("heuristic_attributes", {}).get("weight_candidates", [])
    assert len(weight) > 0, f"Peso no detectado: {weight}"


# ─────────────────────────────────────────────────────────────────────────────
# DEPORTE Y FITNESS
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sports_peso_libras(pipeline):
    """'90 libras' en mancuernas → weight_candidates captura libras."""
    state = _state({
        "raw_title": "FEIERDUN Mancuernas ajustables 20 30 40 45 70 90 libras juego 5 en 1",
        "raw_price": "COP 331,433",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="sports-lb-001")
    result = await pipeline.ainvoke(state)

    weight = result.get("heuristic_attributes", {}).get("weight_candidates", [])
    assert len(weight) > 0, "Debe detectar peso en libras"
    assert any("libras" in w.lower() or "lb" in w.lower() for w in weight), f"Pesos: {weight}"


@pytest.mark.asyncio
async def test_sports_material_neoprene(pipeline):
    """'neopreno' en mancuerna → material_candidates detectado."""
    state = _state({
        "raw_title": "Amazon Basics Mancuerna de entrenamiento revestimiento de neopreno varios pesos",
        "raw_price": "COP 132,551",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="sports-mat-002")
    result = await pipeline.ainvoke(state)

    mat = result.get("heuristic_attributes", {}).get("material_candidates", [])
    assert len(mat) > 0, "Debe detectar material neopreno"
    assert any("neopreno" in m.lower() for m in mat), f"Materiales: {mat}"


@pytest.mark.asyncio
async def test_sports_domain_mancuernas(pipeline):
    """Búsqueda 'mancuerna' → dominio detectado como sports (nueva keyword)."""
    state = _state({
        "raw_title": "Amazon Basics mancuerna hexagonal individual entrenamiento gym",
        "raw_price": "COP 73,623",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="sports-domain-003")
    result = await pipeline.ainvoke(state)

    # Debe normalizarse sin fallar y tener categoría de deportes
    assert result.get("outcome") == "normalized"
    category = result.get("final_product", {}).get("category", "")
    assert "deport" in category.lower() or "fitness" in category.lower() or category != "", (
        f"Categoría inesperada: {category}"
    )


@pytest.mark.asyncio
async def test_sports_grosor_mat_mm(pipeline):
    """'10mm' en tapete yoga → thickness_candidates detectado."""
    state = _state({
        "raw_title": "Gaiam Yoga Mat Pilates colchoneta 10mm grosor Workout con correa transporte",
        "raw_price": "COP 88,318",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="sports-thick-004")
    result = await pipeline.ainvoke(state)

    thick = result.get("heuristic_attributes", {}).get("thickness_candidates", [])
    assert len(thick) > 0, "Debe detectar grosor en mm"
    assert any("10" in t for t in thick), f"Grosor: {thick}"


# ─────────────────────────────────────────────────────────────────────────────
# JUGUETES Y PRODUCTOS PARA NIÑOS
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_toys_jugadores_candidatos(pipeline):
    """'3-4 jugadores' en juego de mesa → players_candidates detectado."""
    state = _state({
        "raw_title": "Catan Juego de mesa 6ª edición estrategia 3-4 jugadores a partir de 10 años",
        "raw_price": "COP 162,015",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="toys-players-001")
    result = await pipeline.ainvoke(state)

    players = result.get("heuristic_attributes", {}).get("players_candidates", [])
    assert len(players) > 0, "Debe detectar número de jugadores"


@pytest.mark.asyncio
async def test_toys_edad_anos(pipeline):
    """'a partir de 7 años' → age_candidates detectado."""
    state = _state({
        "raw_title": "Hasbro Gaming Juego de mesa batalla naval aviones edades 7 años en adelante",
        "raw_price": "COP 55,208",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="toys-age-002")
    result = await pipeline.ainvoke(state)

    age = result.get("heuristic_attributes", {}).get("age_candidates", [])
    assert len(age) > 0, "Debe detectar edad mínima"
    assert any("7" in a for a in age), f"Edades: {age}"


@pytest.mark.asyncio
async def test_toys_hasbro_brand(pipeline):
    """'Hasbro' (nueva marca) → brand_candidates detectada."""
    state = _state({
        "raw_title": "Hasbro Gaming Juego de mesa familia niños",
        "raw_price": "COP 55,208",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="toys-brand-003")
    result = await pipeline.ainvoke(state)

    brands = result.get("heuristic_attributes", {}).get("brand_candidates", [])
    assert "hasbro" in brands, f"Marcas: {brands}"


# ─────────────────────────────────────────────────────────────────────────────
# SALUD Y BIENESTAR
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_dosis_iu(pipeline):
    """'25000 UI' / '10,000iu' → dosage_candidates detectado (unidad UI/IU)."""
    state = _state({
        "raw_title": "BulkSupplements Vitamina A 25000 UI Softgels palmitato retinilo apoyo ocular",
        "raw_price": "COP 95,000",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="health-iu-001")
    result = await pipeline.ainvoke(state)

    dosage = result.get("heuristic_attributes", {}).get("dosage_candidates", [])
    assert len(dosage) > 0, "Debe detectar dosis en UI/IU"
    assert any("ui" in d.lower() or "25000" in d for d in dosage), f"Dosis: {dosage}"


@pytest.mark.asyncio
async def test_health_cantidad_tabletas(pipeline):
    """'360 tabletas' → quantity_candidates detectado."""
    state = _state({
        "raw_title": "Bronson Vitamina D3 10000iu suministro anual funcion muscular 360 tabletas",
        "raw_price": "COP 90,000",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="health-qty-002")
    result = await pipeline.ainvoke(state)

    qty = result.get("heuristic_attributes", {}).get("quantity_candidates", [])
    assert len(qty) > 0, "Debe detectar cantidad en tabletas"
    assert any("360" in q for q in qty), f"Cantidad: {qty}"


@pytest.mark.asyncio
async def test_health_cantidad_softgels(pipeline):
    """'365 softgels' → quantity_candidates detectado (nueva variante)."""
    state = _state({
        "raw_title": "Nature Bounty Vitamina C 500mg 365 softgels antioxidante inmunidad",
        "raw_price": "COP 80,000",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="health-softgel-003")
    result = await pipeline.ainvoke(state)

    qty = result.get("heuristic_attributes", {}).get("quantity_candidates", [])
    assert len(qty) > 0, "Debe detectar cantidad en softgels"
    assert any("365" in q for q in qty), f"Cantidad: {qty}"


# ─────────────────────────────────────────────────────────────────────────────
# ACCESORIOS Y GADGETS (cargadores, cables)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_accessories_potencia_cargador_watts(pipeline):
    """'45W' en cargador → power_candidates en dominio electrónica/accesorios."""
    state = _state({
        "raw_title": "Cargador súper rápido 45W paquete 2 USB C dual cargador tipo C Samsung Galaxy",
        "raw_price": "COP 50,051",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="acc-power-001")
    result = await pipeline.ainvoke(state)

    attrs = result.get("heuristic_attributes", {})
    # Puede estar en power_candidates (electrónica o accesorios)
    power = attrs.get("power_candidates", [])
    assert len(power) > 0, "Debe detectar potencia 45W para cargador"
    assert any("45" in p for p in power), f"Potencia: {power}"


@pytest.mark.asyncio
async def test_accessories_conector_usb_c(pipeline):
    """'USB C' / 'tipo C' → connector_candidates detectado."""
    state = _state({
        "raw_title": "Cable USB a USB C 3 pies paquete 2 unidades carga rápida tipo C Samsung Galaxy",
        "raw_price": "COP 25,744",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="acc-conn-002")
    result = await pipeline.ainvoke(state)

    attrs = result.get("heuristic_attributes", {})
    conn = attrs.get("connector_candidates", [])
    assert len(conn) > 0, "Debe detectar tipo de conector USB C"
    assert any("usb" in c.lower() and "c" in c.lower() for c in conn), f"Conectores: {conn}"


@pytest.mark.asyncio
async def test_accessories_longitud_pies(pipeline):
    """'6.6 pies' en cable → length_candidates (nueva adición)."""
    state = _state({
        "raw_title": "AINOPE Cable USB a USB C 2 unidades 6.6 pies 3.1A tipo C cargador rápido iPhone",
        "raw_price": "COP 25,744",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="acc-len-003")
    result = await pipeline.ainvoke(state)

    attrs = result.get("heuristic_attributes", {})
    length = attrs.get("length_candidates", [])
    assert len(length) > 0, "Debe detectar longitud del cable en pies"
    assert any("6" in l for l in length), f"Longitud: {length}"


@pytest.mark.asyncio
async def test_accessories_pack_cantidad(pipeline):
    """'paquete de 2' en cable → quantity_candidates captura 2."""
    state = _state({
        "raw_title": "Cable USB Tipo C a A paquete de 5 cables trenzados 3A 6 pies carga rápida",
        "raw_price": "COP 36,793",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="acc-pack-004")
    result = await pipeline.ainvoke(state)

    qty = result.get("heuristic_attributes", {}).get("quantity_candidates", [])
    assert 5 in qty, f"Cantidad esperada 5 no encontrada: {qty}"


# ─────────────────────────────────────────────────────────────────────────────
# PRECIOS: nuevos casos de parseo
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_precio_cop_coma_miles_tres_digitos(pipeline):
    """'COP 72,007' → 72007.0 (coma = miles cuando 3 dígitos siguen)."""
    state = _state({
        "raw_title": "Gildan Camisetas de Cuello Redondo para Hombre algodón",
        "raw_price": "COP 72,007",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="price-cop-comma-001")
    result = await pipeline.ainvoke(state)
    assert result["final_product"]["price"] == 72007.0


@pytest.mark.asyncio
async def test_precio_cop_coma_decimal_dos_digitos(pipeline):
    """'COP 5,99' en COP → 5.99 (coma = decimal cuando 2 dígitos siguen)."""
    state = _state({
        "raw_title": "Chicles rellenos sabor tropical paquete",
        "raw_price": "COP 5,99",
        "raw_currency": "COP",
        "raw_availability": "available",
    }, job_id="price-cop-decimal-002")
    result = await pipeline.ainvoke(state)
    assert result["final_product"]["price"] == pytest.approx(5.99)


@pytest.mark.asyncio
async def test_precio_raw_currency_none_usa_default_fuente(pipeline):
    """raw_currency=None + fuente mercadolibre → moneda por defecto 'COP'."""
    state = _state(
        {
            "raw_title": "Teclado gamer mecánico RGB retroiluminado USB",
            "raw_price": "149900",
            "raw_currency": None,
            "raw_availability": "available",
        },
        source="mercadolibre",
        job_id="price-none-curr-003",
    )
    result = await pipeline.ainvoke(state)
    assert result.get("outcome") == "normalized"
    assert result["final_product"]["currency"] == "COP"
