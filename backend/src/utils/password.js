import crypto from 'crypto';

// Mot de passe provisoire à communiquer une seule fois à l'utilisateur.
// Sans caractères ambigus (0/O, 1/I/l) : il peut être dicté ou recopié.
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export function generateTempPassword(length = 14) {
  let out = '';
  for (let i = 0; i < length; i++) out += CHARS[crypto.randomInt(CHARS.length)];
  return out;
}
