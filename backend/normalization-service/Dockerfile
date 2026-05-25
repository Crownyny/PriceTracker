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

# Asegurar herramientas para descargar modelos desde Hugging Face
RUN pip install --no-cache-dir "huggingface_hub>=0.16.0" "transformers>=4.0.0" "safetensors"

# Pre-descargar modelo de embeddings para arranque offline en runtime.
# Usamos snapshot_download para traer todos los archivos necesarios al directorio /models
RUN python - <<'PY'
from huggingface_hub import snapshot_download
import sys
try:
	snapshot_download(repo_id='sentence-transformers/all-MiniLM-L6-v2', local_dir='/models/all-MiniLM-L6-v2', max_workers=4, resume_download=True)
except Exception as e:
	print('ERROR downloading model:', e, file=sys.stderr)
	raise
PY

# Copiar código real (sobreescribe el stub)
COPY normalization-service/ .

CMD ["python", "-m", "app.main"]
