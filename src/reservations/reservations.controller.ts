import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get('ticket/:id')
  getTicket(@Param('id') ticketId: string) {
    return this.reservationsService.getTicket(ticketId);
  }

  @Patch('ticket/:id/pay')
  payTicket(@Param('id') ticketId: string) {
    return this.reservationsService.payTicket(ticketId);
  }

  @Post()
  create(@Body() createReservationDto: CreateReservationDto) {
    return this.reservationsService.create(createReservationDto);
  }

  @Get()
  findAll() {
    return this.reservationsService.findAll();
  }

  @EventPattern('reservation.created')
  handleReservationCreated(@Payload() data: { ticketId: string; seatId: string }) {
    console.log('Nova reserva detectada na fila!');
    console.log(`Ticket: ${data.ticketId} | Assento: ${data.seatId}`);
  }

  @EventPattern('reservation.expired')
  async handleReservationExpired(@Payload() data: { ticketId: string; seatId: string }) {
    console.log('Cancelando reserva...');
    console.log(`Ticket: ${data.ticketId} | Assento: ${data.seatId}`);

    await this.reservationsService.expireReservation(data);
  }
}
