// Actualités d'exemple, pour découvrir la page « Actualités » en développement.
//   node prisma/seed-news.js            → ajoute (ou remet) les exemples
//   node prisma/seed-news.js --remove   → les retire
// À ne pas lancer en production : ces contenus sont fictifs.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PREFIX = 'exemple-';
const IMG = 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1400&auto=format&fit=crop&q=85';
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);
const inDays = (n) => new Date(Date.now() + n * 86_400_000);
const LOREM = "Contenu d'exemple à remplacer depuis l'espace du Super administrateur.\n\nChaque actualité peut comporter plusieurs paragraphes, une image et un lien vers un document.";

const ITEMS = [
  { slug: 'grande-actualite', title: '[Exemple] Grande actualité à la une', category: 'ACTUALITE', isFeatured: true, imageUrl: IMG, publishedAt: daysAgo(1), excerpt: "Exemple de grande actualité principale, affichée en tête de page avec son image." },
  { slug: 'actualite-1', title: "[Exemple] Rentrée universitaire : les dates à retenir", category: 'ACTUALITE', publishedAt: daysAgo(3), excerpt: "Exemple d'actualité récente." },
  { slug: 'actualite-2', title: '[Exemple] Ouverture des candidatures', category: 'ACTUALITE', publishedAt: daysAgo(6), excerpt: "Exemple d'actualité récente." },
  { slug: 'annonce-1', title: '[Exemple] Communiqué de la direction', category: 'ANNONCE_OFFICIELLE', publishedAt: daysAgo(2), excerpt: "Exemple d'annonce officielle de la direction." },
  { slug: 'annonce-2', title: "[Exemple] Calendrier administratif du semestre", category: 'ANNONCE_OFFICIELLE', publishedAt: daysAgo(9), excerpt: "Exemple d'annonce officielle de la direction." },
  { slug: 'conference-1', title: '[Exemple] Conférence sur la recherche appliquée', category: 'CONFERENCE', publishedAt: daysAgo(4), eventAt: inDays(12), location: 'Amphithéâtre A', authors: 'Intervenant à préciser', excerpt: 'Exemple de conférence.' },
  { slug: 'soutenance-1', title: '[Exemple] Soutenance de mémoire de Master', category: 'SOUTENANCE', publishedAt: daysAgo(5), eventAt: inDays(20), location: 'Salle du conseil', authors: 'Candidat à préciser', excerpt: 'Exemple de soutenance.' },
  { slug: 'publication-1', title: "[Exemple] Article scientifique d'un enseignant", category: 'PUBLICATION', publishedAt: daysAgo(15), authors: 'Auteur à préciser', linkUrl: 'https://example.org/', excerpt: 'Exemple de publication scientifique avec lien vers le document.' },
  { slug: 'resultat-1', title: "[Exemple] Résultats d'admission", category: 'RESULTAT', publishedAt: daysAgo(7), excerpt: 'Exemple de résultats autorisés à la diffusion.' },
  { slug: 'activite-1', title: "[Exemple] Journée d'entraide entre étudiants", category: 'ACTIVITE', publishedAt: daysAgo(8), excerpt: 'Exemple d\'activité des enseignants et des étudiants.' },
  { slug: 'archive-1', title: '[Exemple] Publication de plus de douze mois', category: 'ACTUALITE', publishedAt: daysAgo(500), excerpt: 'Exemple classé automatiquement dans les archives.' },
  { slug: 'archive-2', title: "[Exemple] Annonce placée dans les archives", category: 'ANNONCE_OFFICIELLE', publishedAt: daysAgo(40), isArchived: true, excerpt: "Exemple archivé par l'administrateur." },
];

const removed = await prisma.newsArticle.deleteMany({ where: { slug: { startsWith: PREFIX } } });
if (process.argv.includes('--remove')) {
  console.log(`✔ ${removed.count} exemple(s) retiré(s)`);
} else {
  for (const { slug, ...item } of ITEMS) {
    await prisma.newsArticle.create({ data: { ...item, slug: `${PREFIX}${slug}`, body: LOREM, isPublished: true } });
  }
  console.log(`✔ ${ITEMS.length} exemples ajoutés`);
}
await prisma.$disconnect();
