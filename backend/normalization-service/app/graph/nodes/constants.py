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
    "falabella": "COP",
    "olimpica": "COP",
    "amazon": "USD",
}

# Umbral de confianza heurística para saltar el LLM.
# Si el score (número de campos *_candidates no vacíos) alcanza este valor,
# el pipeline usa solo heurísticas y omite los nodos LLM.
# Con threshold=1 el LLM solo se invoca cuando NO se encontró ningún
# atributo heurístico (score==0), lo que ocurre en casos muy difíciles.
HEURISTIC_CONFIDENCE_THRESHOLD: int = 1

# Tokens que no deben considerarse como modelo (node 4)
NON_MODEL_TOKENS: frozenset[str] = frozenset({
    "gb", "tb", "mb", "ghz", "mhz", "mp", "mah",
    "ram", "ssd", "hdd", "4g", "5g", "lte", "wifi",
    # Tipos de memoria RAM — son especificaciones, no identificadores de modelo
    "ddr3", "ddr3l", "ddr4", "ddr5", "ddr6",
    # Versiones de interfaz
    "usb2", "usb3",
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
    "anker", "belkin", "ugreen", "baseus", "aukey",
    # Moda / Calzado / Textil
    "nike", "adidas", "puma", "reebok", "converse", "vans", "fila",
    "levis", "zara", "hm", "uniqlo", "gucci", "balenciaga", "lacoste",
    "tommy", "ralph", "polo", "diesel", "skechers", "new",
    "gildan", "hanes", "nautica", "calvin", "columbia", "wrangler",
    # Hogar / Cocina
    "oster", "black", "decker", "kitchenaid", "cuisinart", "hamilton",
    "whirlpool", "electrolux", "bosch", "haceb", "challenger", "mabe",
    "samurai", "imusa", "universal",
    "ninja", "cosori", "instant", "cuisinart", "oxo", "vitamix",
    # Belleza
    "loreal", "maybelline", "nivea", "dove", "pantene", "garnier",
    "revlon", "neutrogena", "cerave", "olaplex", "clinique", "vichy",
    "cetaphil", "bioderma", "avene", "eucerin",
    # Deporte
    "under", "armour", "speedo", "wilson", "everlast", "gaiam",
    "bowflex", "weider", "gold",
    # Juguetes
    "hasbro", "mattel", "leapfrog", "fisher", "lego", "catan",
    "ravensburger", "playmobil",
    # Salud / Suplementos
    "optimum", "dymatize", "myprotein", "isopure", "bulksupplements",
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
        "computador", "computadora", "laptop", "notebook", "tablet", "televisor", "tv",
        "audio", "video", "cámara", "camara", "impresora",
        "monitor", "teclado", "mouse", "auricular", "audífono", "audifonos",
        "smartwatch", "smarttv", "router", "modem", "proyector", "parlante",
        "pantalla", "cargador", "cable usb", "cable tipo c", "cable cargador",
        "disco duro", "memoria", "usb", "adaptador",
    ],
    # Toys before games so 'juego de mesa' (multi-word, specific) is matched
    # before the single keyword 'gaming' (also present in Hasbro Gaming brand titles)
    "toys": [
        "juguete", "muñeca", "carritos", "lego", "puzzle",
        "rompecabezas", "peluche", "juego de mesa", "fichas", "bloques",
        "pista carros", "control remoto", "dron", "patineta niño",
        "juego de estrategia", "juego educativo", "juego de cartas",
        "juego familiar", "jugadores", "muñeco", "figura de acción",
    ],
    "games": [
        "videojuego", "video juego", "consola", "playstation", "xbox",
        "nintendo", "control juego", "mando", "headset gamer",
        "silla gamer", "teclado gamer", "mouse gamer", "gaming",
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
    # Sports before accessories to avoid short keywords like 'correa' (accessories)
    # stealing sports-primary products that have carrying straps, etc.
    "sports": [
        "deporte", "deportivo", "bicicleta", "bici", "pesa", "gimnasio",
        "fútbol", "futbol", "balón", "balon", "raqueta", "patín", "patin",
        "yoga", "fitness", "natación", "natacion", "running", "ciclismo",
        "trotadora", "elíptica", "eliptica", "piscina", "skate", "boxeo",
        "guantes boxeo", "caminadora",
        "mancuerna", "mancuernas", "dumbbell", "kettlebell", "tapete",
        "colchoneta", "pesas libres", "barbell", "gym", "entrenamiento",
        "crossfit",
    ],
    "accessories": [
        "accesorio", "bolso", "cartera", "mochila", "maleta", "billetera",
        "cinturón", "cinturon", "gorra", "sombrero", "bufanda", "guante",
        "gafas", "lentes", "paraguas", "riñonera", "maletín", "maletin",
        "funda", "carcasa", "correa",
    ],
    "beauty": [
        "belleza", "cuidado personal", "perfume", "crema", "shampoo",
        "maquillaje", "labial", "base", "sérum", "serum", "desodorante",
        "afeitadora", "depiladora", "plancha cabello", "secador", "tinte",
        "esmalte", "body splash", "loción", "locion", "hidratante",
        "mascarilla", "jabón", "jabon", "gel", "protector solar",
    ],
    "health": [
        "salud", "vitamina", "suplemento", "proteína", "proteina",
        "farmacia", "medicamento", "tensiómetro", "tensiometro",
        "termómetro", "termometro", "glucómetro", "glucometro",
        "masajeador", "nebulizador", "oxímetro", "oximetro",
        "silla de ruedas", "andador", "botiquín",
        "cápsula", "capsula", "tableta", "comprimido", "softgel",
        "omega", "colágeno", "probiótico", "melatonina", "zinc",
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
        "bebida energética", "bebida energetica", "energizante",
        "jugo", "refresco", "agua", "té", "infusión", "multivitamínico",
        "queso", "carne", "jamón", "jamon", "pollo", "pescado",
        "mermelada", "mantequilla", "harina", "azúcar", "azucar",
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
}

# Etiqueta de categoría legible por humanos para cada dominio detectado.
# Usada como fallback cuando la fuente no informa la categoría del producto.
DOMAIN_TO_CATEGORY: dict[str, str] = {
    "electronics":  "Electrónica",
    "fashion":      "Moda y Ropa",
    "kitchen":      "Hogar y Cocina",
    "home":         "Hogar",
    "jewelry":      "Joyería y Accesorios",
    "accessories":  "Accesorios",
    "sports":       "Deportes",
    "beauty":       "Belleza y Cuidado Personal",
    "toys":         "Juguetes",
    "health":       "Salud",
    "automotive":   "Automotriz",
    "stationery":   "Papelería",
    "baby":         "Bebé",
    "food":         "Alimentos",
    "tools":        "Herramientas",
    "pet":          "Mascotas",
    "games":        "Videojuegos",
}
