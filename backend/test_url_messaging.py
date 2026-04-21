"""Script para probar el envío de DocumentedScrapingRequest a la cola.

Este script simula el envío de un mensaje de scraping de URL específica
a través de RabbitMQ para probar el flujo completo.
"""
import asyncio
import json
import logging
import sys
from pathlib import Path

# Añadir el directorio padre al path para que `shared` sea importable
sys.path.insert(0, str(Path(__file__).parent))

from shared.messaging import RabbitMQConnection, BasePublisher, QUEUE_SCRAPING_JOBS
from shared.model import DocumentedScrapingRequest

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def send_documented_scraping_request(
    publisher: BasePublisher,
    product_url: str,
    product_ref: str = "test-product-ref",
    priority: int = 5,
    is_update: bool | None = None
) -> None:
    """Envía un DocumentedScrapingRequest a la cola."""
    
    # Crear el mensaje
    request = DocumentedScrapingRequest(
        product_url=product_url,
        product_ref=product_ref,
        priority=priority,
        is_update=is_update,
        metadata={"test": True, "source": "test_script"}
    )
    
    # Convertir a dict y enviar
    message = request.model_dump(mode="json")
    
    await publisher.publish(
        queue_name=QUEUE_SCRAPING_JOBS,
        payload=message
    )
    
    logger.info("DocumentedScrapingRequest enviado:")
    logger.info(f"  search_id: {request.search_id}")
    logger.info(f"  product_url: {request.product_url}")
    logger.info(f"  product_ref: {request.product_ref}")
    logger.info(f"  priority: {request.priority}")
    logger.info(f"  is_update: {request.is_update}")


async def main():
    """Función principal para enviar mensajes de prueba."""
    
    # URLs de prueba
    test_urls = [
        "https://www.exito.com/samsung-galaxy-s23-fe-5g-128gb-8gb-ram-negro-reacondicionado-104295236-mp/p",
        "https://www.alkosto.com/celular-samsung-galaxy-s24-256gb-5g-negro/p/8806095301501"
    ]
    
    # Conexión a RabbitMQ (usar configuración por defecto)
    # RabbitMQ debe estar corriendo en localhost:5672
    try:
        connection = RabbitMQConnection("amqp://guest:guest@localhost:5672/%2f")
        await connection.connect()
        logger.info("Conectado a RabbitMQ")
        
        # Debug: verificar métodos disponibles
        logger.info(f"Métodos disponibles: {[m for m in dir(connection) if not m.startswith('_')]}]")
        logger.info(f"Tiene método publish: {hasattr(connection, 'publish')}")
        
        # Crear publisher
        publisher = BasePublisher(connection)
        
        # Enviar mensajes de prueba
        for i, url in enumerate(test_urls, 1):
            # Alternar entre actualización y búsqueda nueva
            is_update = True if i % 2 == 0 else False
            
            logger.info(f"\n--- Enviando mensaje {i}/{len(test_urls)} ---")
            logger.info(f"Tipo: {'Actualización' if is_update else 'Búsqueda nueva'}")
            await send_documented_scraping_request(
                publisher=publisher,
                product_url=url,
                product_ref=f"test-product-{i}",
                is_update=is_update
            )
            
            # Pequeña pausa entre mensajes
            await asyncio.sleep(1)
        
        logger.info(f"\n{len(test_urls)} mensajes enviados exitosamente")
        logger.info("Inicia el worker del scrapping-service para procesarlos:")
        logger.info("  cd scrapping-service && python -m app.main")
        
    except Exception as e:
        logger.error(f"Error conectando a RabbitMQ: {e}")
        logger.info("Asegúrate de que RabbitMQ esté corriendo:")
        logger.info("  docker run -d -p 5672:5672 -p 15672:15672 rabbitmq:3-management")
        return
    
    finally:
        if 'connection' in locals():
            await connection.close()
            logger.info("Conexión cerrada")


if __name__ == "__main__":
    print("=== Prueba de DocumentedScrapingRequest ===")
    print("Este script enviará mensajes de prueba a la cola de RabbitMQ.")
    print("Asegúrate de que RabbitMQ esté corriendo y el worker esté iniciado.")
    print()
    
    asyncio.run(main())
