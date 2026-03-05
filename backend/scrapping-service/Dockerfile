# El contexto de build es backend/ (ver docker-compose.yml)
# Esto permite copiar el paquete shared sin salir del contexto de Docker.
FROM python:3.12-slim

WORKDIR /app

# Copiar e instalar el paquete compartido (importable como 'shared')
COPY shared/ ./shared/
RUN pip install --no-cache-dir ./shared/

# Instalar dependencias del servicio
COPY scrapping-service/pyproject.toml .
RUN pip install --no-cache-dir .

# Copiar código del servicio
COPY scrapping-service/ .

CMD ["python", "-m", "app.main"]
