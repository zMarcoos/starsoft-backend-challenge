import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'MESSAGE_BROKER',
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const user = configService.getOrThrow<string>('RABBITMQ_USER');
          const password = configService.getOrThrow<string>('RABBITMQ_PASS');
          const host = configService.getOrThrow<string>('RABBITMQ_HOST');

          return {
            transport: Transport.RMQ,
            options: {
              urls: [`amqp://${user}:${password}@${host}:5672`],
              queue: 'reservations_queue',
              queueOptions: {
                durable: true,
              },
            },
          };
        },
      },
      {
        name: 'DELAY_BROKER',
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const user = configService.getOrThrow<string>('RABBITMQ_USER');
          const pass = configService.getOrThrow<string>('RABBITMQ_PASS');
          const host = configService.getOrThrow<string>('RABBITMQ_HOST');

          return {
            transport: Transport.RMQ,
            options: {
              urls: [`amqp://${user}:${pass}@${host}:5672`],
              queue: 'reservations_delay_queue',
              queueOptions: {
                durable: true,
                deadLetterExchange: '',
                deadLetterRoutingKey: 'reservations_queue',
                messageTtl: 30000,
              },
            },
          };
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class RabbitmqModule {}
