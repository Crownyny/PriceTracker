# Atributo `is_update` - Diferenciación entre Actualización y Búsqueda Nueva

## Overview

Se ha añadido el atributo opcional `is_update` a los modelos de solicitud del scraper para diferenciar entre solicitudes de actualización de precios y búsquedas nuevas de productos.

## Modelos Afectados

### 1. `SearchRequest`
```python
class SearchRequest(BaseModel):
    # ... otros campos ...
    is_update: Optional[bool] = None        # True=actualización, False/None=búsqueda nueva
```

### 2. `DocumentedScrapingRequest`
```python
class DocumentedScrapingRequest(BaseModel):
    # ... otros campos ...
    is_update: Optional[bool] = None        # True=actualización, False/None=búsqueda nueva
```

### 3. `ScrapingJob`
```python
class ScrapingJob(BaseModel):
    # ... otros campos ...
    is_update: Optional[bool] = None        # True=actualización, False/None=búsqueda nueva
```

## Mensajes de Comunicación

El atributo `is_update` se propaga a través de todos los mensajes del sistema:

### 1. `ScrapingMessage`
```python
class ScrapingMessage(BaseModel):
    # ... otros campos ...
    is_update: Optional[bool] = None        # True=actualización, False/None=búsqueda nueva
```

### 2. `SearchCompletedMessage`
```python
class SearchCompletedMessage(BaseModel):
    # ... otros campos ...
    is_update: Optional[bool] = None        # True=actualización, False/None=búsqueda nueva
```

### 3. `NormalizedEventMessage`
```python
class NormalizedEventMessage(BaseModel):
    # ... otros campos ...
    is_update: Optional[bool] = None        # True=actualización, False/None=búsqueda nueva
```

### 4. `SearchNormalizedMessage`
```python
class SearchNormalizedMessage(BaseModel):
    # ... otros campos ...
    is_update: Optional[bool] = None        # True=actualización, False/None=búsqueda nueva
```

## Uso

### Para Búsqueda Nueva
```python
request = SearchRequest(
    query="iPhone 15 Pro 128GB",
    product_ref="iphone-15-pro-128gb",
    is_update=False,  # o simplemente omitirlo
    sources=["amazon", "mercadolibre"]
)
```

### Para Actualización
```python
request = SearchRequest(
    query="iPhone 15 Pro 128GB",
    product_ref="iphone-15-pro-128gb",
    is_update=True,
    sources=["amazon", "mercadolibre"]
)
```

### Para Scraping Documentado
```python
request = DocumentedScrapingRequest(
    product_url="https://www.amazon.com/dp/B0CHX2F2QZ",
    product_ref="iphone-15-pro-128gb",
    is_update=True  # para actualizar precio de URL específica
)
```

## Flujo de Propagación

1. **Cliente** envía `SearchRequest`/`DocumentedScrapingRequest` con `is_update`
2. **ScraperWorker** crea `ScrapingJob` propagando `is_update`
3. **Publisher** incluye `is_update` en `ScrapingMessage` y `SearchCompletedMessage`
4. **Normalizer** recibe `is_update` y lo incluye en `NormalizedEventMessage`
5. **Downstream services** pueden usar `is_update` para:
   - Diferenciar notificaciones (nuevos productos vs actualizaciones de precio)
   - Aplicar diferentes estrategias de almacenamiento
   - Implementar lógica de negocio específica

## Casos de Uso Típicos

### 1. Sistema de Notificaciones
- `is_update=False`: Enviar notificación de "nuevo producto encontrado"
- `is_update=True`: Enviar notificación de "precio actualizado"

### 2. Almacenamiento
- `is_update=False`: Crear nuevo registro de producto
- `is_update=True`: Actualizar registro existente

### 3. Análisis y Reportes
- Diferenciar entre descubrimiento de productos y seguimiento de precios
- Métricas separadas para búsquedas vs actualizaciones

## Compatibilidad

El atributo es opcional (`Optional[bool] = None`), lo que garantiza compatibilidad con código existente que no lo utiliza.
