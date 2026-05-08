import asyncio
import os
import json
import logging

import aio_pika

logging.basicConfig(level=logging.INFO)
AMQP_URL = os.getenv("AMQP_URL", "amqp://guest:guest@localhost/")
QUEUE = "normalized.events"

async def on_message(message: aio_pika.abc.AbstractIncomingMessage) -> None:
    async with message.process():
        try:
            payload = json.loads(message.body)
        except Exception:
            payload = message.body.decode(errors="replace")
        print(payload)

async def main() -> None:
    connection = await aio_pika.connect_robust(AMQP_URL)
    async with connection:
        channel = await connection.channel()
        await channel.set_qos(prefetch_count=1)
        queue = await channel.declare_queue(QUEUE, durable=True, passive=True)
        logging.info("Consumiendo la cola %s...", QUEUE)
        await queue.consume(on_message)
        await asyncio.Future()  # keep running

if __name__ == "__main__":
    asyncio.run(main())