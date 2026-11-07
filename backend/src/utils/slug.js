import crypto from 'crypto';

// "Intro to Web Dev!" → "intro-to-web-dev"
export function slugify(text) {
  return (
    text
      .toString()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '') // strip combining accents
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'course'
  );
}

// Slug + short random suffix → collision-resistant unique slug.
export const uniqueSlug = (text) => `${slugify(text)}-${crypto.randomBytes(3).toString('hex')}`;
