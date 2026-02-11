import { ConflictException, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { REDIS_CLIENT } from 'src/redis/redis.module';
import Redis from 'ioredis';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject('MESSAGE_BROKER') private readonly messageBroker: ClientProxy,
    @Inject('DELAY_BROKER') private readonly delayBroker: ClientProxy,
  ) {}

  async create(dto: CreateReservationDto) {
    const { seatId, userId } = dto;

    const lockKey = `seat:lock:${seatId}`;

    const acquiredLock = await this.redis.set(lockKey, userId, 'EX', 30, 'NX');
    if (!acquiredLock) {
      throw new ConflictException('Assento em processo de reserva por outro usuário. Tente novamente em 30 segundos.');
    }

    try {
      const seat = await this.prisma.seat.findUnique({
        where: { id: seatId },
        include: { session: true },
      });
      if (!seat) throw new NotFoundException('Assento não encontrado.');
      if (seat.status !== 'AVAILABLE') throw new ConflictException(`O assento já está ${seat.status}.`);

      const [ticket] = await this.prisma.$transaction([
        this.prisma.ticket.create({
          data: {
            seatId,
            userId,
            price: seat.session.price,
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 30000),
          },
        }),
        this.prisma.seat.update({
          where: { id: seatId },
          data: { status: 'LOCKED' },
        }),
      ]);

      this.messageBroker.emit('reservation.created', {
        ticketId: ticket.id,
        seatId: seat.id,
      });

      this.delayBroker.emit('reservation.expired', {
        ticketId: ticket.id,
        seatId: seat.id,
      });

      return {
        message: 'Reserva temporária criada com sucesso. Aguardando pagamento.',
        ticketId: ticket.id,
        expiresAt: ticket.expiresAt,
      };
    } catch (error) {
      await this.redis.del(lockKey);

      console.error('Erro ao reservar assento:', error);
      throw new InternalServerErrorException('Falha interna ao processar a reserva.');
    }
  }

  findAll() {
    return this.prisma.session.findMany({
      include: {
        movie: true,
        seats: {
          orderBy: { number: 'asc' },
        },
      },
    });
  }

  async expireReservation(data: { ticketId: string; seatId: string }) {
    const { ticketId, seatId } = data;

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) return;

    if (ticket.status === 'PENDING') {
      console.log(`O tempo esgotou! Expirando reserva não paga. Ticket: ${ticketId}`);

      await this.prisma.$transaction([
        this.prisma.ticket.update({
          where: { id: ticketId },
          data: { status: 'CANCELED' },
        }),
        this.prisma.seat.update({
          where: { id: seatId },
          data: { status: 'AVAILABLE' },
        }),
      ]);

      console.log(`Assento ${seatId} liberado e devolvido ao sistema.`);
    }
  }

  async payTicket(ticketId: string) {
    try {
      const [updatedTicket] = await this.prisma.$transaction([
        this.prisma.ticket.update({
          where: {
            id: ticketId,
            status: 'PENDING',
          },
          data: { status: 'PAID' },
        }),
      ]);

      await this.prisma.seat.update({
        where: { id: updatedTicket.seatId },
        data: { status: 'SOLD' },
      });

      return {
        message: 'Pagamento aprovado! Assento garantido.',
        ticket: updatedTicket,
      };
    } catch (error) {
      throw new ConflictException(
        error,
        'Pagamento recusado. O ticket não existe, já foi pago ou o tempo de reserva expirou.',
      );
    }
  }

  async getTicket(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { seat: true },
    });
    if (!ticket) throw new NotFoundException('Ticket não encontrado.');

    return ticket;
  }
}
