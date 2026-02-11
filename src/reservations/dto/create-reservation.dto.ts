import { IsUUID, IsNotEmpty } from 'class-validator';

export class CreateReservationDto {
  @IsUUID(4, { message: 'O ID do assento deve ser um UUID válido.' })
  @IsNotEmpty({ message: 'O ID do assento é obrigatório.' })
  seatId!: string;

  @IsUUID(4, { message: 'O ID do usuário deve ser um UUID válido.' })
  @IsNotEmpty({ message: 'O ID do usuário é obrigatório.' })
  userId!: string;
}
