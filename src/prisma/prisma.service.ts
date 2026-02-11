import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(private configService: ConfigService) {
    const user = configService.getOrThrow<string>('POSTGRES_USER');
    const password = configService.getOrThrow<string>('POSTGRES_PASSWORD');
    const host = configService.getOrThrow<string>('POSTGRES_HOST');
    const port = configService.getOrThrow<number>('POSTGRES_PORT');
    const db = configService.getOrThrow<string>('POSTGRES_DB');

    const connectionString = `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({ adapter });

    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    console.log('Banco de dados conectado (Prisma + pg Adapter + ConfigService)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
