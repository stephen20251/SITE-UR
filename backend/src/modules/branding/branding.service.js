import { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';

const prisma = new PrismaClient();

const DEFAULTS = {
  name: 'Université de Référence',
  shortName: 'UR',
  primaryColor: '#1a365d',
  secondaryColor: '#ffffff',
  accentColor: '#FFD166',
  fontFamily: 'Arial, sans-serif',
};

// Get branding (create with defaults if none exists)
export async function getBranding() {
  let b = await prisma.schoolBranding.findFirst();
  if (!b) {
    b = await prisma.schoolBranding.create({ data: DEFAULTS });
  }
  return b;
}

// Update branding fields (partial)
export async function updateBranding(data) {
  let b = await prisma.schoolBranding.findFirst();
  if (!b) {
    return prisma.schoolBranding.create({ data: { ...DEFAULTS, ...data } });
  }
  return prisma.schoolBranding.update({ where: { id: b.id }, data });
}

// Resolve {{school.*}} variables map for template injection
export async function resolveBrandingVars() {
  const b = await getBranding();
  const BASE_URL = env.API_URL;

  function toUrl(path) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${BASE_URL}${path}`;
  }

  return {
    'school.name':            b.name,
    'school.shortName':       b.shortName,
    'school.primary_color':   b.primaryColor,
    'school.secondary_color': b.secondaryColor,
    'school.accent_color':    b.accentColor,
    'school.font':            b.fontFamily,
    'school.logo':            toUrl(b.logoUrl),
    'school.secondary_logo':  toUrl(b.secondaryLogoUrl),
    'school.background':      toUrl(b.backgroundUrl),
    'school.watermark':       toUrl(b.watermarkUrl),
    'school.stamp':           toUrl(b.stampUrl),
    'school.signature':       toUrl(b.signatureUrl),
    'school.icon':            toUrl(b.iconUrl),
    'school.address':         b.address ?? 'Antananarivo, Madagascar',
    'school.phone':           b.phone ?? '',
    'school.email':           b.email ?? '',
    'school.website':         b.website ?? '',
    // Back-compat aliases used in existing templates
    'university.logo':        toUrl(b.logoUrl),
    'university.name':        b.name,
  };
}
