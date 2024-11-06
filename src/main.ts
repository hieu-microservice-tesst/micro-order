import { NestFactory } from '@nestjs/core';
import { OrderModule } from './order/order.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(OrderModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'http://127.0.0.1:15672'],
      queue: 'order_queue',
      queueOptions: { durable: false },
    },
  });

  app.startAllMicroservices().catch(error => console.error('Microservice error:', error));
  await app.listen(3000);
}

bootstrap();
