import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsService } from './reservations.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { ConflictException } from '@nestjs/common';

describe('ReservationsService (Testes de Concorrência)', () => {
  let service: ReservationsService;
  let redisMock: any;

  beforeEach(async () => {
    redisMock = {
      set: jest.fn().mockResolvedValue(null),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: {} },
        { provide: REDIS_CLIENT, useValue: redisMock },
        { provide: 'MESSAGE_BROKER', useValue: { emit: jest.fn() } },
        { provide: 'DELAY_BROKER', useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
  });

  it('Deve bloquear a reserva e lançar ConflictException se o assento já estiver em processo de compra', async () => {
    const dto = { seatId: 'uuid-assento-123', userId: 'uuid-user-456' };

    await expect(service.create(dto)).rejects.toThrow(ConflictException);
    await expect(service.create(dto)).rejects.toThrow('Assento em processo de reserva');
  });
});
