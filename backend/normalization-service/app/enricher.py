"""
DEPRECADO: La lógica de enriquecimiento ha migrado al nodo `enrich`
del grafo LangGraph en app/graph/nodes.py (make_enrich_node).

El LLM se configura a través del worker (NormalizerWorker) usando
las variables de entorno ENABLE_ENRICHER y OPENAI_API_KEY.

Conservado para no romper importaciones en ramas en vuelo.
"""
