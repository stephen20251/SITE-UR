# Déploiement sur Hostinger

Offre visée : **Unlimited Web Hosting** (applications Node.js et bases MySQL).
Le dépôt GitHub `stephen20251/SITE-UR` contient deux applications, déployées séparément :

| Application | Dossier du dépôt | Adresse (exemple) | Rôle |
|---|---|---|---|
| **API** | `backend` | `https://api.votre-domaine.com` | Base de données, comptes, fichiers, temps réel |
| **Site** | `.` (racine) | `https://votre-domaine.com` | Pages affichées aux visiteurs |

Remplacez `votre-domaine.com` par votre vrai domaine partout dans ce guide.

> L'interface de hPanel évolue. Si un intitulé diffère de ce guide, cherchez le réglage
> équivalent ; les valeurs à saisir restent les mêmes.

---

## 1. Base de données MySQL

1. hPanel → **Bases de données** → **Gestion des bases MySQL**.
2. Créez une base et un utilisateur, avec un mot de passe long. Notez :
   le **nom de la base**, l'**utilisateur**, le **mot de passe** et l'**hôte** affiché (souvent `localhost`).
3. Construisez l'adresse de connexion :

   ```
   mysql://UTILISATEUR:MOT_DE_PASSE@HOTE:3306/NOM_DE_LA_BASE
   ```

   Si le mot de passe contient `@ # / : ?`, remplacez-les par `%40 %23 %2F %3A %3F`.

Les tables, les rôles, la structure de l'université et le premier Super administrateur
sont créés **automatiquement au premier démarrage de l'API** : aucun terminal n'est nécessaire.

## 2. Dossier des fichiers déposés

Vidéos, documents, photos et CV sont enregistrés sur le disque. Un nouveau déploiement
Git remplace le dossier de l'application : les fichiers doivent donc être rangés **à côté**.

1. hPanel → **Gestionnaire de fichiers** : notez le chemin de votre dossier personnel
   (de la forme `/home/u123456789`).
2. Créez `ur-fichiers/uploads` et `ur-fichiers/private` dans ce dossier personnel.
3. Les chemins complets serviront pour `UPLOADS_DIR` et `PRIVATE_UPLOADS_DIR`.

À vérifier au premier essai : après un redéploiement, une photo de profil ajoutée avant
doit toujours s'afficher.

## 3. Application API

hPanel → **Sites web** → **Ajouter un site web** → **Application web Node.js** →
importez depuis GitHub (application GitHub de Hostinger) le dépôt `SITE-UR`.

| Réglage | Valeur |
|---|---|
| Branche | celle à mettre en ligne (`main` après fusion) |
| Version de Node.js | 20 ou 22 |
| Dossier de l'application (root directory) | `backend` |
| Commande d'installation | `npm install` |
| Commande de build | `npm run build` |
| Commande de démarrage | `npm start` |
| Fichier d'entrée (si demandé à la place) | `src/production.js` |
| Domaine | `api.votre-domaine.com` |

**Variables d'environnement** (paramètres de l'application, jamais dans Git) :

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | l'adresse de l'étape 1 |
| `JWT_ACCESS_SECRET` | 96 caractères aléatoires (voir ci-dessous) |
| `JWT_REFRESH_SECRET` | 96 autres caractères aléatoires |
| `CORS_ORIGIN` | `https://votre-domaine.com,https://www.votre-domaine.com` |
| `APP_URL` | `https://votre-domaine.com` |
| `API_URL` | `https://api.votre-domaine.com` |
| `UPLOADS_DIR` | `/home/u123456789/ur-fichiers/uploads` |
| `PRIVATE_UPLOADS_DIR` | `/home/u123456789/ur-fichiers/private` |
| `ADMIN_EMAIL` | `joel.stephen2017@gmail.com` |
| `ADMIN_PASSWORD` | mot de passe du Super administrateur (12 caractères minimum) |
| `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME` | prénom et nom |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | `mananonyamboara@gmail.com` |
| `SMTP_PASS` | le mot de passe d'application Google (16 caractères) |
| `MAIL_FROM` | `Université Références <mananonyamboara@gmail.com>` |

Pour générer un secret, sur votre ordinateur :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Lancez le déploiement. Au premier démarrage, les journaux de l'application affichent :
`Migrations de la base`, `Données de base`, `Création du Super administrateur`, puis
`University System backend on …`. Vérifiez ensuite `https://api.votre-domaine.com/health`
(réponse `{"ok":true,…}`).

**Ensuite, retirez `ADMIN_EMAIL` et `ADMIN_PASSWORD`** des variables et redémarrez.
L'API refuse de démarrer si la configuration est dangereuse (secrets d'exemple,
`CORS_ORIGIN=*`, adresses en localhost) : le message d'erreur indique quoi corriger.

## 4. Application Site

Ajoutez une deuxième application web Node.js depuis le même dépôt :

| Réglage | Valeur |
|---|---|
| Version de Node.js | 20 ou 22 |
| Dossier de l'application | `.` (racine du dépôt) |
| Commande d'installation | `npm install` |
| Commande de build | `npm run build` |
| Commande de démarrage | `npm start` |
| Fichier d'entrée (si demandé) | `.output/server/index.mjs` |
| Domaine | `votre-domaine.com` |

Variable d'environnement, **lue pendant le build** :

| Variable | Valeur |
|---|---|
| `VITE_API_URL` | `https://api.votre-domaine.com` (sans `/api` à la fin) |

Si vous changez `VITE_API_URL`, relancez un déploiement : la valeur est intégrée au build.

## 5. Vérifications après la mise en ligne

1. Le site s'ouvre ; la page **Actualités** s'affiche (vide au début).
2. **Espace numérique** → **Classroom** : connexion avec `joel.stephen2017@gmail.com`.
3. **Utilisateurs** : créez les comptes du personnel. Un mot de passe provisoire s'affiche
   une seule fois : transmettez-le à la personne.
4. Ajoutez une photo de profil, redéployez l'API, vérifiez que la photo est toujours là.
5. Créez un compte test avec votre propre adresse et vérifiez la réception des e-mails.
6. Configurez l'année universitaire en cours dans **Années universitaires**.

## Sauvegardes

- **Base** : hPanel → Bases de données → **phpMyAdmin** → Exporter (format SQL).
  Hostinger fait aussi des sauvegardes automatiques (hPanel → Sauvegardes).
- **Fichiers** : téléchargez le dossier `ur-fichiers` depuis le Gestionnaire de fichiers.

## Mises à jour

Poussez les modifications sur la branche déployée puis relancez le déploiement des deux
applications. Les nouvelles migrations de base sont appliquées au démarrage de l'API.

## En cas de problème

| Symptôme | Cause probable |
|---|---|
| L'API ne démarre pas : « Configuration de production incomplète » | Une variable de l'étape 3 manque ou garde sa valeur d'exemple |
| L'API ne démarre pas : erreur de connexion à la base | `DATABASE_URL` : hôte, mot de passe ou caractère spécial non encodé |
| Le site s'affiche mais rien ne charge (connexion impossible) | `VITE_API_URL` absent ou faux au moment du build, ou `CORS_ORIGIN` ne contient pas l'adresse exacte du site |
| Les photos et vidéos disparaissent après un déploiement | `UPLOADS_DIR` pointe dans le dossier de l'application |
| « Trop de requêtes » pour tous les utilisateurs | Le proxy n'est pas reconnu : ajoutez `TRUST_PROXY=1` (ou `2`) |
