import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const rabbitUser = configService.getOrThrow<string>('RABBITMQ_USER');
  const rabitPassword = configService.getOrThrow<string>('RABBITMQ_PASS');
  const rabbitHost = configService.getOrThrow<string>('RABBITMQ_HOST');

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [`amqp://${rabbitUser}:${rabitPassword}@${rabbitHost}:5672`],
      queue: 'reservations_queue',
      queueOptions: {
        durable: true,
      },
    },
  });

  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api/v1');

  await app.startAllMicroservices();
  await app.listen(3000);

  console.log('Sistema Híbrido Iniciado: REST API + RabbitMQ Consumer na porta 3000');
}

bootstrap().catch((error) => {
  console.error('Erro fatal ao iniciar a aplicação:', error);
  process.exit(1);
});
