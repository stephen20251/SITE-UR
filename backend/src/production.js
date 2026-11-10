// Point d'entrée de production (« npm start », ou fichier d'entrée sur l'hébergeur) :
// prépare la base (migrations, première installation) puis lance le serveur.
//
// Pas de « await » au niveau principal de ce fichier : sur Hostinger, le lanceur
// LiteSpeed (lsnode.js) charge le fichier d'entrée avec require(), qui refuse les
// modules contenant un await de premier niveau (ERR_REQUIRE_ASYNC_MODULE). Les étapes
// sont donc enchaînées avec des import() dynamiques.
import('../prisma/bootstrap.js')
  .then(() => import('./server.js'))
  .catch((err) => {
    console.error('✖ Démarrage impossible :', err);
    process.exit(1);
  });
