import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('*'),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  // Adresse publique du site (liens des e-mails) et de l'API (photos, QR codes, lettres)
  APP_URL: z.string().default('http://localhost:8081'),
  API_URL: z.string().optional(),
  // Derrière le proxy de l'hébergeur : nombre de proxys de confiance (adresse IP réelle
  // des visiteurs pour la limite de connexions). Par défaut 1 en production.
  TRUST_PROXY: z.coerce.number().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const data = parsed.data;
const prod = data.NODE_ENV === 'production';
// En production, refuser une configuration dangereuse plutôt que démarrer.
if (prod) {
  const problems = [];
  if (/change_me/i.test(data.JWT_ACCESS_SECRET) || /change_me/i.test(data.JWT_REFRESH_SECRET)) problems.push('JWT_ACCESS_SECRET / JWT_REFRESH_SECRET : remplacez les valeurs d\'exemple');
  if (data.JWT_ACCESS_SECRET === data.JWT_REFRESH_SECRET) problems.push('JWT_ACCESS_SECRET et JWT_REFRESH_SECRET doivent être différents');
  if (data.CORS_ORIGIN.trim() === '*') problems.push('CORS_ORIGIN : indiquez l\'adresse du site (https://votre-domaine.com), pas *');
  if (/localhost|127\.0\.0\.1/.test(data.APP_URL)) problems.push('APP_URL : indiquez l\'adresse publique du site');
  if (!data.API_URL || /localhost|127\.0\.0\.1/.test(data.API_URL)) problems.push('API_URL : indiquez l\'adresse publique de l\'API');
  if (problems.length) {
    console.error(`❌ Configuration de production incomplète :\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
}

export const env = {
  ...data,
  APP_URL: data.APP_URL.replace(/\/+$/, ''),
  API_URL: (data.API_URL ?? process.env.BASE_URL ?? `http://localhost:${data.PORT}`).replace(/\/+$/, ''),
  TRUST_PROXY: data.TRUST_PROXY ?? (prod ? 1 : 0),
};
