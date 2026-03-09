# Nodos del Pipeline de Normalización

```
START → 1 → 2 → 3 → 4 → 5 ─┬─(score ≥ 3)──► 8 → 9 → save → END
                              └─(score < 3)──► 6 → 7 → 8 ↗
                              
Cualquier error ──► error_end → END
```

## Nodos

| # | Archivo | Nodo | Descripción |
|---|---------|------|-------------|
| 1 | `input_sanitizer.py` | Input Sanitizer | Limpia strings (unicode, espacios), parsea precio a entero, mapea availability, rechaza títulos nulos |
| 2 | `field_standardizer.py` | Field Standardizer | Mapea campos crudos al esquema interno (`title`, `price`, `currency`, `availability`, `category`, `image_url`, `description`) |
| 3 | `text_canonicalizer.py` | Text Canonicalizer | Separa tokens unidos (`256gb` → `256 gb`), normaliza símbolos (`+` → `plus`, `/` → espacio) |
| 4 | `attribute_extractor.py` | Attribute Candidate Extractor | Extrae candidatos heurísticos via regex: storage, memory, modelo, color, condición, marca |
| 5 | `quality_evaluator.py` | Attribute Quality Evaluator | Calcula score 0-4. Si ≥ 3 salta al nodo 8 (sin LLM) |
| 6 | `llm_extractor.py` | LLM Attribute Extractor | Extrae atributos con LLM pequeño. Solo se ejecuta si score < 3 |
| 7 | `attribute_merger.py` | Attribute Merger | Fusiona heurísticas + LLM. LLM tiene prioridad en conflictos |
| 8 | `semantic_normalizer.py` | Product Semantic Normalizer | Genera `canonical_name` y representación canónica (LLM o determinista) |
| 9 | `validation.py` | Validation + Confidence | Valida coherencia (storage ≥ memory), asegura brand/model en canonical_name, calcula confianza final (high/medium/low) |

## Auxiliares

| Archivo | Descripción |
|---------|-------------|
| `save.py` | Persiste `NormalizedProduct` en PostgreSQL + historial de precios |
| `error_end.py` | Nodo terminal: registra error y cierra el pipeline |
| `constants.py` | Diccionarios compartidos (colores, condiciones, monedas, tokens no-modelo) |
| `helpers.py` | `heuristic_to_merged()` — convierte candidatos heurísticos al formato fusionado |
