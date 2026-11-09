// Point d'entrée de production (« npm start », ou fichier d'entrée sur l'hébergeur) :
// prépare la base (migrations, première installation) puis lance le serveur.
await import('../prisma/bootstrap.js');
await import('./server.js');
