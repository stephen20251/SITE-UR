// ═══════════════════════════════════════════════════════════════
//  SEED — Catégories (domaines) des cours en ligne (ESM)
//  Idempotent : crée les catégories manquantes et classe les cours qui
//  n'ont pas encore de catégorie (par mots-clés du titre). Les cours déjà
//  classés ne sont jamais modifiés.
// ═══════════════════════════════════════════════════════════════
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Ordre important : la première règle qui correspond l'emporte.
const CATEGORIES = [
  { slug: 'design-creation', name: 'Design & Création numérique', icon: '🎨', color: '#c026d3',
    description: 'UI/UX, dessin, photographie, vidéo.', keywords: ['design', 'ui/ux', 'dessin', 'photo', 'montage', 'vidéo'] },
  { slug: 'cybersecurite-cloud', name: 'Cybersécurité & Cloud', icon: '🛡️', color: '#0f766e',
    description: 'Sécurité, réseaux, conteneurs et DevOps.', keywords: ['cyber', 'sécurité', 'docker', 'kubernetes', 'devops', 'réseau', 'cloud'] },
  { slug: 'data-ia', name: 'Data & Intelligence artificielle', icon: '📊', color: '#0284c7',
    description: 'Bases de données, analyse de données, machine learning.', keywords: ['données', 'sql', 'machine learning', 'excel', 'data', 'intelligence'] },
  { slug: 'finance-comptabilite', name: 'Finance & Comptabilité', icon: '💰', color: '#d97706',
    description: 'Comptabilité, finance d’entreprise, fiscalité.', keywords: ['comptab', 'finance', 'fiscal'] },
  { slug: 'marketing-communication', name: 'Marketing & Communication', icon: '📣', color: '#e11d48',
    description: 'Marketing digital, communication, vente.', keywords: ['marketing', 'communication digitale', 'vente'] },
  { slug: 'langues', name: 'Langues', icon: '🌍', color: '#059669',
    description: 'Anglais, français et autres langues.', keywords: ['anglais', 'english', 'français', 'langue '] },
  { slug: 'gestion-entrepreneuriat', name: 'Gestion & Entrepreneuriat', icon: '📈', color: '#7c3aed',
    description: 'Management, gestion de projet, création d’entreprise.', keywords: ['gestion', 'entrepren', 'management', 'projet'] },
  { slug: 'developpement-programmation', name: 'Développement & Programmation', icon: '💻', color: '#4f46e5',
    description: 'Algorithmique, langages, web et mobile.', keywords: ['algorithm', 'programmation', 'javascript', 'react', 'node', 'java', 'python', 'language c', 'langage c', 'framework', 'flutter', 'mobile', 'web', 'typescript'] },
  { slug: 'mathematiques-sciences', name: 'Mathématiques & Sciences', icon: '🧮', color: '#334155',
    description: 'Mathématiques, statistiques, physique.', keywords: ['math', 'statist', 'physique'] },
]

async function main() {
  console.log('🗂️  Catégories des cours en ligne...\n')
  const bySlug = {}
  for (const { keywords, ...c } of CATEGORIES) {
    const cat = await prisma.onlineCategory.upsert({ where: { slug: c.slug }, update: {}, create: c })
    bySlug[c.slug] = cat.id
  }
  console.log(`✅ ${CATEGORIES.length} catégories`)

  const courses = await prisma.onlineCourse.findMany({ where: { categoryId: null }, select: { id: true, title: true } })
  let classed = 0
  for (const course of courses) {
    const t = course.title.toLowerCase()
    const rule = CATEGORIES.find((c) => c.keywords.some((k) => t.includes(k)))
    if (!rule) { console.log(`  · non classé : ${course.title}`); continue }
    await prisma.onlineCourse.update({ where: { id: course.id }, data: { categoryId: bySlug[rule.slug] } })
    console.log(`  ${rule.icon} ${course.title} → ${rule.name}`)
    classed += 1
  }
  console.log(`\n✅ ${classed} cours classés (${courses.length - classed} laissés sans catégorie)`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
