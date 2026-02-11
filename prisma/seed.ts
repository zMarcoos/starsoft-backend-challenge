import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando o seed do banco de dados...');

  await prisma.ticket.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.session.deleteMany();
  await prisma.movie.deleteMany();
  console.log('🧹 Banco de dados limpo.');

  const movie = await prisma.movie.create({
    data: {
      title: 'Matrix da Concorrência',
      description:
        'Um filme sobre desenvolvedores lutando contra Race Conditions.',
      duration: 120,
    },
  });
  console.log(`🎬 Filme criado: ${movie.title}`);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(20, 0, 0, 0);

  const session = await prisma.session.create({
    data: {
      movieId: movie.id,
      price: 50.0,
      startsAt: tomorrow,
    },
  });
  console.log(`📅 Sessão criada para: ${session.startsAt.toISOString()}`);

  const rows = ['A', 'B', 'C', 'D', 'E'];
  const seatsPerRow = 10;
  let totalSeats = 0;

  console.log('🪑 Criando assentos...');

  const seatPromises: Promise<unknown>[] = [];

  for (const row of rows) {
    for (let number = 1; number <= seatsPerRow; number++) {
      seatPromises.push(
        prisma.seat.create({
          data: {
            sessionId: session.id,
            row: row,
            number: number,
            status: 'AVAILABLE',
          },
        }),
      );
      totalSeats++;
    }
  }

  await Promise.all(seatPromises);
  console.log(`✅ ${totalSeats} assentos criados com sucesso!`);
}

main()
  .catch((error) => {
    console.error('❌ Erro no seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
