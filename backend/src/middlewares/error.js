import { HttpError } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';

// Nom lisible des champs des formulaires (inscription, candidature…)
const FIELD_LABELS = {
  email: 'Adresse e-mail', password: 'Mot de passe', firstName: 'Prénom', lastName: 'Nom',
  phone: 'Téléphone', mentionId: 'Mention', level: 'Niveau', role: 'Type de compte', system: 'Espace',
  newPassword: 'Nouveau mot de passe', currentPassword: 'Mot de passe actuel', title: 'Titre', text: 'Texte',
  options: 'Réponses', answers: 'Réponses', name: 'Nom', code: 'Code', description: 'Description',
}

// Message clair en français à partir d'une erreur de validation (zod)
export function validationMessage(err) {
  const issues = err?.issues ?? err?.errors ?? []
  const parts = issues.slice(0, 3).map((i) => {
    const field = FIELD_LABELS[i.path?.[i.path.length - 1]] ?? (i.path?.length ? String(i.path[i.path.length - 1]) : 'Champ')
    if (i.code === 'invalid_type' && (i.received === 'undefined' || i.received === 'null')) return `${field} : champ obligatoire`
    if (i.code === 'too_small' && i.type === 'string') return i.minimum <= 1 ? `${field} : champ obligatoire` : `${field} : ${i.minimum} caractères minimum`
    if (i.code === 'too_big' && i.type === 'string') return `${field} : ${i.maximum} caractères maximum`
    if (i.code === 'invalid_string' && i.validation === 'email') return `${field} : adresse invalide (exemple : nom@gmail.com)`
    if (i.code === 'invalid_string' && i.validation === 'uuid') return `${field} : choix invalide, sélectionnez dans la liste`
    if (i.code === 'invalid_enum_value') return `${field} : valeur non autorisée`
    if (i.code === 'custom' && i.message) return i.message
    return `${field} : valeur invalide`
  })
  return parts.length ? parts.join(' · ') : 'Certaines informations sont invalides : vérifiez le formulaire.'
}

// eslint-disable-next-line no-unused-vars
export function errorMiddleware(err, req, res, next) {
  if (err?.name === 'ZodError') {
    return res.status(400).json({ error: validationMessage(err), details: err.flatten?.() ?? err.errors });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  // Erreurs métier levées sous forme d'objet simple : throw { status, message }
  if (err && !(err instanceof Error) && Number.isInteger(err.status) && err.message) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  if (err?.name === 'MulterError') {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop volumineux' : err.message });
  }
  // Prisma known errors
  if (err?.code === 'P2002') {
    const target = String(err.meta?.target ?? '')
    const msg = /email/i.test(target)
      ? 'Un compte existe déjà avec cette adresse e-mail : connectez-vous, ou utilisez « Mot de passe oublié ».'
      : 'Cet élément existe déjà (doublon).'
    return res.status(409).json({ error: msg, details: err.meta })
  }
  if (err?.code === 'P2025') {
    return res.status(404).json({ error: 'Élément introuvable (il a peut-être été supprimé).' })
  }
  console.error('[error]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    ...(env.NODE_ENV !== 'production' && { message: err?.message }),
  });
}

export function notFoundMiddleware(req, res) {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
}
