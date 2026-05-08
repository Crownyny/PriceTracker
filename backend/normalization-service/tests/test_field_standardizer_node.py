import pytest

from app.graph.nodes.field_standardizer import field_standardizer_node


def _state_with_description(description):
    return {
        "source_name": "test-source",
        "sanitized_product": {
            "raw_title": "Producto de prueba",
            "_parsed_price": 1000,
            "_currency": "COP",
            "_availability": "in_stock",
            "raw_category": "electronics",
            "raw_image_url": "https://example.com/image.jpg",
            "raw_url": "https://example.com/product",
            "raw_description": description,
        },
    }


@pytest.mark.asyncio
async def test_description_html_basico_se_convierte_a_texto():
    state = _state_with_description("<p><strong>Auriculares</strong> Bluetooth</p><p>Con ANC</p>")

    result = await field_standardizer_node(state)

    description = result["standardized_product"]["description"]
    assert description == "Auriculares Bluetooth Con ANC"


@pytest.mark.asyncio
async def test_description_html_escapado_se_convierte_a_texto():
    state = _state_with_description("&lt;p&gt;Auriculares&nbsp;Bluetooth&lt;/p&gt;")

    result = await field_standardizer_node(state)

    assert result["standardized_product"]["description"] == "Auriculares Bluetooth"


@pytest.mark.asyncio
async def test_description_html_doble_escapado_se_convierte_a_texto():
    state = _state_with_description("&amp;lt;p&amp;gt;JBL Wave Buds 2&amp;lt;/p&amp;gt;")

    result = await field_standardizer_node(state)

    assert result["standardized_product"]["description"] == "JBL Wave Buds 2"


@pytest.mark.asyncio
async def test_description_elimina_script_y_style():
    state = _state_with_description(
        "<style>.x{color:red}</style><p>Auriculares</p><script>alert('x')</script><p>Con ANC</p>"
    )

    result = await field_standardizer_node(state)

    description = result["standardized_product"]["description"]
    assert "alert" not in description
    assert "color:red" not in description
    assert description == "Auriculares Con ANC"


@pytest.mark.asyncio
async def test_description_html_malformado_no_rompe_y_extrae_texto():
    state = _state_with_description("<p>Auriculares <div>Bluetooth <strong>ANC")

    result = await field_standardizer_node(state)

    description = result["standardized_product"]["description"]
    assert "Auriculares" in description
    assert "Bluetooth" in description
    assert "ANC" in description
    assert "<" not in description and ">" not in description


@pytest.mark.asyncio
async def test_description_texto_con_signos_menor_mayor_no_se_interpreta_como_html():
    plain = "Pantalla 15 < 17 y 20 > 10"
    state = _state_with_description(plain)

    result = await field_standardizer_node(state)

    assert result["standardized_product"]["description"] == plain


@pytest.mark.asyncio
async def test_description_html_con_comentarios_no_incluye_comentario():
    state = _state_with_description("<!-- interno --><p>Audio JBL</p>")

    result = await field_standardizer_node(state)

    assert result["standardized_product"]["description"] == "Audio JBL"


@pytest.mark.asyncio
async def test_description_none_regresa_vacio():
    state = _state_with_description(None)

    result = await field_standardizer_node(state)

    assert result["standardized_product"]["description"] == ""


@pytest.mark.asyncio
async def test_description_html_largo_tipo_scraper_se_limpia_completo():
    long_html = (
        "<p><span style='font-size:18px;'><strong>Auriculares Inalambricos Bluetooth Wave Buds 2</strong></span></p>"
        "<p>La vida es demasiado corta como para aburrirse</p>"
        "<p>El sonido de calidad es ahora mas facil y divertido.</p>"
        "<p>Incluye cancelacion de ruido activa y modo ambient.</p>"
        "<p>Con hasta 40 horas de reproduccion&nbsp;y carga rapida.</p>"
        "<p>____________________________________________________</p>"
        "<p>ESPECIFICACIONES</p>"
        "<p>Driver size 8.0 mm Dynamic Driver</p>"
        "<p>Power supply 5V 1A</p>"
        "<p>Maximum operation temperature 45 C</p>"
        "<p>Frequency response 20 Hz - 20 kHz</p>"
        "<p>Impedance 16 ohm</p>"
        "<p>Sensitivity 110 dB SPL at 1 kHz</p>"
        "<p>Bluetooth version 5.3</p>"
        "<p>Bluetooth transmitter frequency range 2.4 GHz - 2.4835 GHz</p>"
        "<p>Charging time 2 hrs from empty</p>"
        "<p>Music playtime with BT on and ANC off Up to 10 hrs</p>"
        "<p>Contenido de la caja</p>"
        "<p>&nbsp;&nbsp;&nbsp;&nbsp;1 par de auriculares</p>"
        "<p>&nbsp;&nbsp;&nbsp;&nbsp;1 cable de carga USB tipo C</p>"
        "<p>&nbsp;&nbsp;&nbsp;&nbsp;1 funda de carga</p>"
    )

    state = _state_with_description(long_html)
    result = await field_standardizer_node(state)

    description = result["standardized_product"]["description"]
    assert description
    assert "<" not in description and ">" not in description
    assert "&nbsp;" not in description
    assert "Auriculares Inalambricos Bluetooth Wave Buds 2" in description
    assert "Con hasta 40 horas de reproduccion y carga rapida." in description
    assert "ESPECIFICACIONES" in description
    assert "Bluetooth version 5.3" in description
    assert "1 cable de carga USB tipo C" in description
