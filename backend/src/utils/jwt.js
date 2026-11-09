import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

export const signAccessToken = (payload) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES });

export const signRefreshToken = (payload) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES });

export const verifyAccessToken = (token) => {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  // Les jetons à usage précis (lien de vidéo signé, réinitialisation de mot de passe)
  // portent un « typ » : ils ne doivent jamais ouvrir une session.
  if (payload.typ) throw new jwt.JsonWebTokenError('Jeton de session invalide');
  return payload;
};
export const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);

// Store hashed refresh tokens in DB (never the raw value)
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
