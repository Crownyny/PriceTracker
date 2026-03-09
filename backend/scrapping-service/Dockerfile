# El contexto de build es backend/ (ver docker-compose.yml)
# Esto permite copiar el paquete shared sin salir del contexto de Docker.
FROM python:3.12-slim

WORKDIR /app

# Dependencias del sistema requeridas por Playwright/Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libcairo2 libx11-6 libxext6 \
    libxrender1 libxtst6 fonts-liberation wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar el paquete compartido (importable como 'shared')
COPY shared/ ./shared/
RUN pip install --no-cache-dir ./shared/

# Instalar dependencias del servicio
COPY scrapping-service/pyproject.toml .
RUN pip install --no-cache-dir .

# Instalar binario de Chromium para Playwright
RUN playwright install chromium --with-deps

# Copiar código del servicio
COPY scrapping-service/ .

CMD ["python", "-m", "app.main"]
