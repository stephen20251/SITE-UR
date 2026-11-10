# Déploiement sur Hostinger

Offre : **Unlimited Web Hosting** (palier « Business » : jusqu'à 5 applications Node.js,
bases MySQL, messagerie). Le dépôt GitHub `stephen20251/SITE-UR`, branche **`main`**,
contient deux applications, déployées séparément :

| Application | Dossier du dépôt (Root directory) | Adresse | Rôle |
|---|---|---|---|
| **Site** | `.` (racine) | `https://univreference.com` | Pages affichées aux visiteurs |
| **API** | `backend` | `https://api.univreference.com` | Base de données, comptes, fichiers, temps réel |

> L'interface de hPanel évolue. Si un intitulé diffère de ce guide, cherchez le réglage
> équivalent ; les valeurs à saisir restent les mêmes.

**Ordre conseillé** : 1. Site → 2. Base MySQL → 3. Adresse e-mail → 4. Dossier des fichiers
→ 5. API → 6. Vérifications. (La base se crée depuis la gestion d'un site : on crée donc
d'abord le site.)

---

## 1. Application Site (`univreference.com`)

hPanel → **Sites web** → **Ajouter un site web** (ou, sur l'accueil, **Créer ou migrer**)
→ **Application web Node.js** → **Importer un dépôt Git** → **Se connecter avec GitHub** :
installez l'application GitHub de Hostinger et autorisez le dépôt `SITE-UR`.

| Réglage | Valeur |
|---|---|
| Dépôt / branche | `stephen20251/SITE-UR` · `main` |
| Domaine | `univreference.com` |
| Préréglage (Framework preset) | **Other** (autre) |
| Version de Node.js | **22** |
| Root directory | `.` (racine du dépôt, laisser vide si proposé) |
| Build command | `npm run build` |
| Output directory | (vide) |
| Entry file | `.output/server/index.mjs` |

L'installation (`npm install`) est faite automatiquement par Hostinger.

**Variable d'environnement** (section « Variables d'environnement » avant le premier
déploiement ; elle est lue pendant la construction) :

| Variable | Valeur |
|---|---|
| `VITE_API_URL` | `https://api.univreference.com` (sans `/api` à la fin) |

Si vous changez `VITE_API_URL` plus tard, relancez un déploiement : la valeur est intégrée
au site pendant la construction.

## 2. Base de données MySQL

1. Dans la gestion du site créé à l'étape 1 : **Bases de données** →
   **Gestion des bases de données MySQL**.
2. Créez une base `ur` et un utilisateur `ur` (Hostinger ajoute un préfixe : `u123456789_ur`),
   avec le mot de passe **généré** par hPanel. Gardez-le en lieu sûr. Évitez si possible
   `@ # / : ?` (sinon remplacez-les par `%40 %23 %2F %3A %3F`).
3. Notez le nom complet de la base, l'utilisateur et l'hôte (souvent `localhost`).
4. Adresse de connexion (pour l'étape 5) :

   ```
   mysql://UTILISATEUR:MOT_DE_PASSE@HOTE:3306/NOM_DE_LA_BASE
   ```

Les tables, les rôles, la structure de l'université et le premier Super administrateur sont
créés **automatiquement au premier démarrage de l'API**.

## 3. Adresse e-mail d'envoi (messagerie Hostinger)

La plateforme envoie des e-mails : accès des comptes créés par l'administration, mot de passe
provisoire, lien « Mot de passe oublié ».

1. hPanel → **E-mails** (ou, sur l'accueil, **Obtenez votre adresse email gratuite**) :
   associez la messagerie au domaine `univreference.com`.
2. Créez la boîte **`contact@univreference.com`** avec un mot de passe long.
3. Ouvrez-la dans le webmail et envoyez-vous un message de test.
4. Réglages d'envoi : serveur `smtp.hostinger.com`, port **465** (SSL), identifiant =
   l'adresse complète, mot de passe = celui de la boîte.

## 4. Dossier des fichiers déposés

Vidéos, documents, photos et CV sont enregistrés sur le disque. Hostinger remplace le dossier
de l'application à chaque déploiement : les fichiers doivent être rangés **à côté**.

1. hPanel → **Gestionnaire de fichiers** : notez le chemin de votre dossier personnel
   (de la forme `/home/u123456789`).
2. Créez `ur-fichiers/uploads` et `ur-fichiers/private` dans ce dossier personnel.

## 5. Application API (`api.univreference.com`)

1. Créez d'abord le **sous-domaine** `api.univreference.com` (hPanel → **Domaines** →
   **Sous-domaines**, ou proposé pendant l'ajout du site). Pour Hostinger, un sous-domaine
   est un site à part entière.
2. **Sites web** → **Ajouter un site web** → **Application web Node.js** → même dépôt :

| Réglage | Valeur |
|---|---|
| Dépôt / branche | `stephen20251/SITE-UR` · `main` |
| Domaine | `api.univreference.com` |
| Préréglage | **Express** (ou **Other**) |
| Version de Node.js | **22** |
| Root directory | `backend` |
| Build command | `npm run build` |
| Output directory | (vide) |
| Entry file | `src/production.js` |

**Variables d'environnement** (jamais dans Git) :

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | l'adresse de l'étape 2 |
| `JWT_ACCESS_SECRET` | 96 caractères aléatoires (voir ci-dessous) |
| `JWT_REFRESH_SECRET` | 96 autres caractères aléatoires |
| `CORS_ORIGIN` | `https://univreference.com,https://www.univreference.com` |
| `APP_URL` | `https://univreference.com` |
| `API_URL` | `https://api.univreference.com` |
| `UPLOADS_DIR` | `/home/u123456789/ur-fichiers/uploads` |
| `PRIVATE_UPLOADS_DIR` | `/home/u123456789/ur-fichiers/private` |
| `TRUST_PROXY` | `1` |
| `ADMIN_EMAIL` | `joel.stephen2017@gmail.com` |
| `ADMIN_PASSWORD` | mot de passe du Super administrateur (12 caractères minimum) |
| `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME` | prénom et nom |
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `contact@univreference.com` |
| `SMTP_PASS` | le mot de passe de cette boîte (étape 3) |
| `MAIL_FROM` | `Université Références <contact@univreference.com>` |

Pour générer un secret, sur votre ordinateur :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Au premier démarrage, les journaux affichent : `Migrations de la base`, `Données de base`,
`Création du Super administrateur`, puis `University System backend on …`. Vérifiez
`https://api.univreference.com/health` (réponse `{"ok":true,…}`).

**Ensuite, retirez `ADMIN_EMAIL` et `ADMIN_PASSWORD`** des variables (l'enregistrement
redéploie l'application). L'API refuse de démarrer si la configuration est dangereuse
(secrets d'exemple, `CORS_ORIGIN=*`, adresses en localhost) : le message indique quoi corriger.

### Particularités de Hostinger (applications Node.js)

- **Temps réel** : Hostinger n'accepte pas les WebSocket entrants. La messagerie et les
  notifications passent automatiquement par des requêtes HTTP (socket.io en « polling »).
- **Mise en veille** : sans visite pendant un moment, l'application s'arrête et redémarre à
  la requête suivante (premier affichage un peu plus lent). Au redémarrage, l'API vérifie les
  migrations.
- **Durée d'une requête** : 120 secondes au maximum (envoi de très grosses vidéos à éviter
  sur une connexion lente).

## 6. Vérifications après la mise en ligne

1. Le site s'ouvre ; la page **Actualités** s'affiche (vide au début).
2. **Espace numérique** → **Espace université** : connexion avec `joel.stephen2017@gmail.com`.
   Dans **Mon profil** → **Changer mon mot de passe** si besoin.
3. **Utilisateurs** → **Nouvel utilisateur** : créez le second Super administrateur,
   `mananonyamboara@gmail.com`, rôle **Super Admin**, sans saisir de mot de passe.
   Il reçoit un e-mail avec son identifiant et un mot de passe provisoire : c'est aussi le
   test de la messagerie. L'écran indique si l'e-mail est parti ; sinon, il affiche le mot
   de passe provisoire à transmettre vous-même.
4. Les deux Super administrateurs créent ensuite les autres comptes de la même façon.
5. Sur la page de connexion, testez **Mot de passe oublié ?** : le lien reçu par e-mail
   doit ouvrir `https://univreference.com/reinitialiser-mot-de-passe…`.
6. Ajoutez une photo de profil, redéployez l'API, vérifiez que la photo est toujours là.
7. Ouvrez la messagerie avec deux comptes : un message envoyé doit apparaître chez l'autre.
8. **Configuration → Structure → Mentions → Modifier** : remplissez la présentation de chaque
   mention (affichée sur l'accueil).
9. Configurez l'année universitaire en cours dans **Années universitaires**.

## Sauvegardes

- **Base** : hPanel → Bases de données → **phpMyAdmin** → Exporter (format SQL).
  Hostinger fait aussi des sauvegardes automatiques (hPanel → Sauvegardes).
- **Fichiers** : téléchargez le dossier `ur-fichiers` depuis le Gestionnaire de fichiers.

## Mises à jour

Poussez les modifications sur `main` : Hostinger reconstruit automatiquement les deux
applications. Les nouvelles migrations de base sont appliquées au démarrage de l'API.

## En cas de problème

| Symptôme | Cause probable |
|---|---|
| L'API ne démarre pas : « Configuration de production incomplète » | Une variable de l'étape 5 manque ou garde sa valeur d'exemple |
| L'API ne démarre pas : erreur de connexion à la base | `DATABASE_URL` : hôte, mot de passe ou caractère spécial non encodé |
| Le site s'affiche mais rien ne charge (connexion impossible) | `VITE_API_URL` absent ou faux au moment de la construction, ou `CORS_ORIGIN` ne contient pas l'adresse exacte du site |
| Le site ne démarre pas (erreur 503) | Vérifiez l'Entry file `.output/server/index.mjs` ; essayez le préréglage **Nitro** avec Output directory `.output` et Entry file `server/index.mjs` |
| Les photos et vidéos disparaissent après un déploiement | `UPLOADS_DIR` pointe dans le dossier de l'application |
| Les e-mails ne partent pas (« messagerie non configurée ») | Variables `SMTP_*` absentes ou fausses : vérifiez le mot de passe de la boîte et le port 465 (sinon 587) |
| Les e-mails arrivent dans les indésirables | Dans hPanel → E-mails, vérifiez que les enregistrements DNS (SPF, DKIM) du domaine sont actifs |
| « Trop de requêtes » pour tous les utilisateurs | Le proxy n'est pas reconnu : `TRUST_PROXY=1` (ou `2`) |
| Le Super administrateur ne peut plus se connecter (et l'e-mail « Mot de passe oublié » n'arrive pas) | Dans les variables de l'API : `ADMIN_EMAIL`, `ADMIN_PASSWORD` = nouveau mot de passe (12 caractères min.) et `ADMIN_RESET_PASSWORD` = `oui`. Enregistrez (l'API redémarre, le journal affiche « Super administrateur mis à jour »), connectez-vous, puis retirez ces trois variables. |
