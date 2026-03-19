# El contexto de build es backend/ (ver docker-compose.yml)
FROM python:3.12-slim

WORKDIR /app

# Copiar e instalar el paquete compartido (importable como 'shared')
COPY shared/ ./shared/
RUN pip install --no-cache-dir ./shared/

# Instalar dependencias del servicio
# Stub de app/ necesario para que setuptools descubra el paquete sin código fuente
COPY normalization-service/pyproject.toml .
RUN mkdir -p app && touch app/__init__.py && pip install --no-cache-dir .

# Copiar código real (sobreescribe el stub)
COPY normalization-service/ .

CMD ["python", "-m", "app.main"]
