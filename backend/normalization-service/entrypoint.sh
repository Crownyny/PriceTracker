#!/bin/sh
set -e

MODEL_DIR="${SENTENCE_TRANSFORMERS_HOME}/all-MiniLM-L6-v2"

if [ ! -d "$MODEL_DIR" ] || [ -z "$(ls -A "$MODEL_DIR" 2>/dev/null)" ]; then
    echo "Descargando modelo all-MiniLM-L6-v2..."
    python -c "
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id='sentence-transformers/all-MiniLM-L6-v2',
    local_dir='$MODEL_DIR',
    max_workers=1
)
" && echo "Modelo descargado."
fi

exec python -m app.main
