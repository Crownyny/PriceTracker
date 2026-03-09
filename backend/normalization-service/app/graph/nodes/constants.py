"""Diccionarios y constantes compartidos entre nodos."""

COLORS: frozenset[str] = frozenset({
    "black", "negro", "white", "blanco", "gris", "silver", "gold",
    "blue", "azul", "verde", "green", "violeta", "purple", "red", "rojo",
    "pink", "rosa", "orange", "naranja", "yellow", "amarillo",
    "gray", "grey", "titanium", "cream", "beige",
})

CONDITIONS: dict[str, str] = {
    "reacondicionado": "refurbished",
    "refurbished": "refurbished",
    "renewed": "refurbished",
    "renovado": "refurbished",
    "nuevo": "new",
    "new": "new",
    "usado": "used",
    "used": "used",
    "como nuevo": "like_new",
    "like new": "like_new",
}

AVAILABILITY_MAP: dict[str, str] = {
    "available": "in_stock", "in stock": "in_stock",
    "disponible": "in_stock", "en stock": "in_stock",
    "true": "in_stock", "1": "in_stock", "yes": "in_stock",
    "sí": "in_stock", "si": "in_stock",
    "out": "out_of_stock", "out of stock": "out_of_stock",
    "agotado": "out_of_stock", "no disponible": "out_of_stock",
    "unavailable": "out_of_stock", "false": "out_of_stock",
    "0": "out_of_stock", "no": "out_of_stock",
}

CURRENCY_MAP: dict[str, str] = {
    "col$": "COP", "$ cop": "COP", "cop": "COP",
    "r$": "BRL", "brl": "BRL",
    "usd": "USD",
    "eur": "EUR", "€": "EUR",
    "gbp": "GBP", "£": "GBP",
    "mxn": "MXN",
    "$": "USD",
}

# Moneda por defecto según fuente conocida.
# Si la fuente no está aquí, se usa "USD" como fallback global.
SOURCE_DEFAULT_CURRENCY: dict[str, str] = {
    "mercadolibre": "COP",
    "exito": "COP",
    "amazon": "USD",
}

# Tokens que no deben considerarse como modelo (node 4)
NON_MODEL_TOKENS: frozenset[str] = frozenset({
    "gb", "tb", "mb", "ghz", "mhz", "mp", "mah",
    "ram", "ssd", "hdd", "4g", "5g", "lte", "wifi",
})

# Marcas conocidas para mejorar la detección heurística de brand.
# Mantener en minúsculas. Se compara contra tokens del título en lowercase.
KNOWN_BRANDS: frozenset[str] = frozenset({
    # Electrónica
    "apple", "samsung", "xiaomi", "huawei", "motorola", "nokia", "sony",
    "lg", "asus", "acer", "dell", "hp", "lenovo", "msi", "toshiba",
    "panasonic", "philips", "jbl", "bose", "logitech", "razer", "corsair",
    "kingston", "sandisk", "seagate", "nvidia", "amd", "intel", "epson",
    "canon", "nikon", "gopro", "garmin", "fitbit", "oppo", "realme",
    "honor", "google", "microsoft", "nintendo", "xbox", "playstation",
    # Moda / Calzado
    "nike", "adidas", "puma", "reebok", "converse", "vans", "fila",
    "levis", "zara", "hm", "uniqlo", "gucci", "balenciaga", "lacoste",
    "tommy", "ralph", "polo", "diesel", "skechers", "new",
    # Hogar / Cocina
    "oster", "black", "decker", "kitchenaid", "cuisinart", "hamilton",
    "whirlpool", "electrolux", "bosch", "haceb", "challenger", "mabe",
    "samurai", "imusa", "universal",
    # Belleza
    "loreal", "maybelline", "nivea", "dove", "pantene", "garnier",
    "revlon", "neutrogena",
    # Deporte
    "under", "armour", "speedo", "wilson", "everlast",
    # Herramientas
    "dewalt", "makita", "stanley", "truper", "pretul",
    # Mascotas
    "purina", "pedigree", "whiskas", "royal",
})

# Palabras clave por dominio para detección automática de categoría (en español).
# Para añadir un dominio: agrega una nueva clave con su lista de keywords.
DOMAIN_KEYWORDS: dict[str, list[str]] = {
    "electronics": [
        "electrónica", "electronica", "celular", "teléfono", "telefono",
        "computador", "computadora", "laptop", "tablet", "televisor", "tv",
        "audio", "video", "cámara", "camara", "gaming", "impresora",
        "monitor", "teclado", "mouse", "auricular", "audífono", "audifonos",
        "smartwatch", "smarttv", "router", "modem", "proyector", "parlante",
    ],
    "fashion": [
        "ropa", "moda", "camiseta", "camisa", "pantalón", "pantalon",
        "vestido", "falda", "chaqueta", "abrigo", "zapato", "zapatilla",
        "tenis", "bota", "sandalia", "calzado", "jean", "leggins", "blusa",
        "shorts", "bermuda", "pijama", "interior", "traje", "sudadera",
        "buzo", "polo", "overol", "medias", "calcetines",
    ],
    "kitchen": [
        "cocina", "electrodoméstico", "electrodomestico", "licuadora",
        "nevera", "refrigerador", "microondas", "estufa", "horno",
        "olla", "sartén", "vajilla", "utensilio", "cafetera",
        "batidora", "tostadora", "extractor", "sandwichera", "freidora",
        "arrocera", "exprimidor", "plancha cocina", "greca",
    ],
    "home": [
        "hogar", "decoración", "decoracion", "mueble", "sala", "dormitorio",
        "colchón", "colchon", "almohada", "cortina", "alfombra", "lámpara",
        "lampara", "ventilador", "jardín", "jardin", "baño", "organizador",
        "estante", "armario", "closet", "silla", "mesa", "escritorio",
        "sofá", "sofa", "cama", "ducha", "grifería",
    ],
    "jewelry": [
        "joyería", "joyeria", "anillo", "collar", "pulsera", "aretes",
        "cadena", "dije", "reloj", "joya", "oro", "plata", "diamante",
        "esmeralda", "zircon", "bisutería", "bisuteria", "piercing",
    ],
    "accessories": [
        "accesorio", "bolso", "cartera", "mochila", "maleta", "billetera",
        "cinturón", "cinturon", "gorra", "sombrero", "bufanda", "guante",
        "gafas", "lentes", "paraguas", "riñonera", "maletín", "maletin",
        "funda", "carcasa", "correa",
    ],
    "sports": [
        "deporte", "deportivo", "bicicleta", "bici", "pesa", "gimnasio",
        "fútbol", "futbol", "balón", "balon", "raqueta", "patín", "patin",
        "yoga", "fitness", "natación", "natacion", "running", "ciclismo",
        "trotadora", "elíptica", "eliptica", "piscina", "skate", "boxeo",
        "guantes boxeo", "caminadora",
    ],
    "beauty": [
        "belleza", "cuidado personal", "perfume", "crema", "shampoo",
        "maquillaje", "labial", "base", "sérum", "serum", "desodorante",
        "afeitadora", "depiladora", "plancha cabello", "secador", "tinte",
        "esmalte", "body splash", "loción", "locion", "hidratante",
        "mascarilla", "jabón", "jabon", "gel", "protector solar",
    ],
    "toys": [
        "juguete", "muñeca", "carritos", "lego", "puzzle",
        "rompecabezas", "peluche", "juego de mesa", "fichas", "bloques",
        "pista carros", "control remoto", "dron", "patineta niño",
    ],
    "health": [
        "salud", "vitamina", "suplemento", "proteína", "proteina",
        "farmacia", "medicamento", "tensiómetro", "tensiometro",
        "termómetro", "termometro", "glucómetro", "glucometro",
        "masajeador", "nebulizador", "oxímetro", "oximetro",
        "silla de ruedas", "andador", "botiquín",
    ],
    "automotive": [
        "automotriz", "auto", "carro", "moto", "vehículo", "vehiculo",
        "llanta", "aceite motor", "repuesto", "casco moto", "cargador carro",
        "filtro aceite", "frenos", "alarma carro", "amortiguador",
        "luces led carro", "tapa sol", "organizador carro",
    ],
    "stationery": [
        "papelería", "papeleria", "libro", "cuaderno", "lápiz", "lapiz",
        "bolígrafo", "boligrafo", "agenda", "útiles", "utiles", "escolar",
        "resma", "carpeta", "archivador", "separadores", "marcador",
        "corrector", "tijeras", "pegante",
    ],
    "baby": [
        "pañal", "panal", "coche bebé", "cuna", "biberón", "biberon",
        "tetero", "andador bebé", "cargador bebé", "monitor bebé",
        "asiento bebé", "chupete", "talco bebé", "aceite bebé",
    ],
    "food": [
        "alimento", "comida", "bebida", "snack", "café", "cafe",
        "chocolate", "cereal", "arroz", "aceite comestible", "leche",
        "yogur", "galleta", "atún", "pasta", "sopa", "salsa", "condimento",
        "proteína en polvo", "barra proteína",
    ],
    "tools": [
        "herramienta", "taladro", "martillo", "destornillador", "sierra",
        "pintura", "sellador", "tornillo", "clavo", "ferretería", "ferreteria",
        "nivel", "cinta métrica", "cinta metrica", "llave tuercas",
        "compresor", "pulidora", "soldadora", "escalera",
    ],
    "pet": [
        "mascota", "perro", "gato", "pecera", "acuario", "comedero",
        "correa perro", "collar perro", "arena gato", "alimento perro",
        "alimento gato", "ropa mascota", "juguete mascota", "portamascotas",
        "antiparasitario", "shampoo mascota",
    ],
    "games": [
        "videojuego", "video juego", "consola", "playstation", "xbox",
        "nintendo", "control juego", "mando", "headset gamer",
        "silla gamer", "teclado gamer", "mouse gamer",
    ],
}
