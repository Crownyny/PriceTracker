# El contexto de build es backend/ (ver docker-compose.yml)
FROM python:3.12-slim

WORKDIR /app

ENV SENTENCE_TRANSFORMERS_HOME=/models

# Copiar e instalar el paquete compartido (importable como 'shared')
COPY shared/ ./shared/
RUN pip install --no-cache-dir ./shared/

# Instalar dependencias del servicio
# Stub de app/ necesario para que setuptools descubra el paquete sin código fuente
COPY normalization-service/pyproject.toml .
RUN mkdir -p app && touch app/__init__.py && pip install --no-cache-dir .

# Copiar código real (sobreescribe el stub)
# Pre-descargar modelo de embeddings para arranque offline en runtime.
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='sentence-transformers/all-MiniLM-L6-v2', local_dir='/models/all-MiniLM-L6-v2', local_dir_use_symlinks=False)"

# Copiar código real (sobreescribe el stub)
COPY normalization-service/ .

CMD ["python", "-m", "app.main"]
