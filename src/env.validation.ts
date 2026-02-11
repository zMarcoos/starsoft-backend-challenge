import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),

  POSTGRES_HOST: z.string(),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB: z.string(),

  REDIS_HOST: z.string(),
  REDIS_PORT: z.coerce.number().default(6379),

  RABBITMQ_USER: z.string(),
  RABBITMQ_PASS: z.string(),
  RABBITMQ_HOST: z.string(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    console.error(
      '❌ Erro fatal na configuração de ambiente:',
      result.error.issues,
    );
    throw new Error(
      'Configuração de ambiente inválida. Verifique o arquivo .env',
    );
  }

  return result.data;
}
