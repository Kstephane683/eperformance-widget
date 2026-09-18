# P3-PUSH — L'abonnement aux notifications, côté widget

**Date :** 18 septembre 2026 · **Périmètre :** dépôt `eperformance-widget` uniquement.
**Hors périmètre, non touché :** `src/sdk/**` (gelé par contrat), `public/sw.js`
(tâche 6.4, inchangé), les pages `application/**`, le dossier `native/`.
**Amont :** `backend/docs/phase3-push-subscribe/COMPLETION.md` (endpoint
`GET /api/chatbot/push/config`, livré et déployé) et
`backend/docs/phase3-push-subscribe/RAPPORT.md` (§7.3 : la clé publique devait
atteindre le navigateur).

| Livrable | État | Preuve |
|---|---|---|
| 1. Appel réel à `PushManager.subscribe()` | livré | `src/helpers/push.ts` |
| 2. Jamais au premier chargement, jamais sans action volontaire | livré | §2 + 9 tests |
| 3. Un visiteur qui a refusé n'est pas relancé | livré | §2.3 + 3 tests |
| 4. Quatre états lisibles (non configuré, refusé, abonné, erreur) | livré | §3 |
| 5. Désabonnement possible | livré | `desabonnerNotifications()` + 5 tests |
| 6. Dégradation propre (sans clé, sans API, iOS non installé, iframe) | livré | §4 + 6 tests |
| 7. Tests du widget : 219 avant, 296 après | vérifié | §6 |
| 8. Build de production vert, SDK intact | vérifié | §6.3 |
| 9. Ce rapport | livré | ce fichier |

---

## 1. Ce qui est livré

### 1.1 Fichiers

| Fichier | Nature |
|---|---|
| `src/helpers/push.ts` | **nouveau** — capacités du navigateur, politique d'état (fonctions pures), appel à `PushManager.subscribe()`, enregistrement et désabonnement côté serveur, mémoire locale |
| `src/stores/notifications.ts` | **nouveau** — état courant, trois actions (`charger`, `activer`, `desactiver`), resynchronisation |
| `src/components/ReglageNotifications.vue` | **nouveau** — le réglage tel que le visiteur le voit |
| `src/views/Help.vue` | une ligne : le réglage est monté dans l'onglet Aide |
| `src/helpers/push.spec.ts` | **nouveau** — 53 tests |
| `src/components/notifications.spec.ts` | **nouveau** — 24 tests |

Aucun fichier existant n'est modifié en dehors de `Help.vue`. Le service worker
(`public/sw.js`) était déjà complet pour la réception : il n'est pas touché. Le
SDK (`src/sdk/`) n'est pas touché.

### 1.2 Le parcours

```
  Onglet Aide
    └── section « Notifications »
          ├── état lisible (titre, phrase, bouton)
          └── clic sur « Activer »
                 │
                 ├── 1. Notification.requestPermission()      ← SEULE occurrence du widget
                 │      refusée  → état « refusé », on s'arrête là (rien n'est appelé)
                 │      accordée → on continue
                 ├── 2. GET /api/chatbot/push/config          ← la clé publique du serveur
                 ├── 3. navigator.serviceWorker.ready         ← un worker ACTIF (délai borné)
                 ├── 4. pushManager.subscribe({ userVisibleOnly: true,
                 │                              applicationServerKey: <clé en octets> })
                 ├── 5. POST /api/chatbot/push/subscribe      ← endpoint + clés + site + conversation
                 └── 6. état « abonné » (mémorisé localement)
```

Le désabonnement suit le chemin inverse, **serveur d'abord** :

```
  clic sur « Désactiver »
       ├── 1. DELETE /api/chatbot/push/unsubscribe?endpoint=…   ← le serveur cesse d'envoyer
       └── 2. pushManager.getSubscription() puis unsubscribe()  ← le navigateur oublie
```

Cet ordre est délibéré : c'est le serveur qui décide d'envoyer. Si la requête
serveur échoue, l'abonnement local est **conservé** et l'opération peut être
réessayée ; dans l'autre ordre, une panne réseau laisserait un serveur qui
envoie encore à un visiteur qui a demandé l'arrêt. Un test vérifie l'ordre
exact (`['DELETE', 'navigateur']`).

---

## 2. La règle du consentement explicite

C'est la règle la plus importante de cette tâche, et elle est appliquée à trois
niveaux, chacun vérifié par des tests qui échouent si elle tombe.

### 2.1 Jamais au premier chargement

Le montage du réglage fait **une seule** chose : lire la configuration du serveur
(GET, public, sans effet) et l'état déjà mémorisé. Aucune demande de permission,
aucun abonnement, aucun POST. Vérifié par :

* `ne demande AUCUNE permission au chargement — la règle la plus importante`
* `n'envoie AUCUN abonnement au chargement`
* `ne lit la configuration qu'une fois`
* `ne demande aucune permission en ouvrant l'onglet Aide` (test monté dans le
  widget réel, routeur et Pinia comme en production)

### 2.2 Seulement après une action volontaire

`Notification.requestPermission()` n'apparaît **qu'une seule fois** dans tout le
code du widget : dans `activerNotifications()`, qui n'est atteignable que par le
clic sur le bouton du réglage. Le composant n'expose aucune autre porte
d'entrée, et le store ne l'appelle que depuis `activer()`.

Trois cas sont distingués, et un seul ouvre la boîte de dialogue :

| Permission actuelle | Ce que fait un clic sur « Activer » |
|---|---|
| `default` (jamais répondu) | ouvre la boîte de dialogue du navigateur |
| `granted` (déjà accordée) | n'ouvre rien : s'abonne directement |
| `denied` (refusée) | **ne fait rien** : affiche l'état « refusé » |

### 2.3 Un visiteur qui a refusé n'est jamais relancé

Quand la permission vaut `denied`, l'activation retourne l'état `refuse` **avant
toute autre opération** : aucune requête réseau n'est émise, aucun abonnement
n'est tenté, et le réglage n'affiche **aucun bouton** — seulement l'état et la
phrase qui explique comment revenir sur la décision depuis les réglages du
navigateur. Un test monte le réglage dans un navigateur qui a refusé et vérifie
que `requestPermission` n'est jamais appelé, y compris après un clic.

Un refus dans la boîte de dialogue n'abonne rien non plus : le code s'arrête
avant même de lire la configuration (vérifié : `fetch` n'est pas appelé).

### 2.4 Une permission accordée n'est jamais redemandée

`permission === 'granted'` court-circuite la demande : un visiteur qui a déjà
accepté n'est pas interrogé une seconde fois.

---

## 3. Les quatre états lisibles

| État | Quand | Ce que voit le visiteur |
|---|---|---|
| `inactif` | proposable, permission jamais décidée ou accordée sans abonnement | « Recevoir les nouvelles de Mia » + bouton **Activer** |
| `abonne` | abonnement enregistré, permission accordée | « Mia peut vous prévenir » + bouton **Désactiver** |
| `refuse` | permission refusée | « Notifications refusées » + la marche à suivre, **aucun bouton de relance** |
| `erreur` | une étape a échoué | l'échec en clair + bouton **Réessayer** (l'action que le visiteur tentait) |
| `non_configure` | le serveur n'a pas de clé publique | **rien** — la fonctionnalité n'est pas proposée (§4) |
| `indisponible` | pas d'API push dans ce contexte | **rien** — idem |

La politique complète est dans `resoudreEtatNotifications()`, une fonction
**pure** : elle se teste sans DOM, et le composant ne fait que l'appliquer —
même construction que `doitProposerInvitation()` pour l'invite d'installation
(tâche 6.4).

`configure` côté serveur est vrai seulement si le serveur peut **envoyer** (clés
publique *et* privée, bibliothèque présente) : recueillir un consentement qu'on
ne pourrait pas honorer serait une fausse promesse. Le widget ne propose donc
jamais une activation qui ne pourrait pas aboutir.

---

## 4. Dégradation propre — les cinq cas, et ce qui se passe

| Situation | `supportPush()` | Ce qui s'affiche | Ce qui casse |
|---|---|---|---|
| Navigateur ancien (`PushManager` absent) | faux | rien | rien |
| iframe sur un site hôte | faux | rien | rien |
| Contexte non sécurisé (`http://` hors localhost) | faux | rien | rien |
| iOS Safari **sans installation** | faux | rien | rien |
| Serveur sans clé VAPID (production actuelle) | vrai | rien (état `non_configure`) | rien |
| Serveur injoignable | vrai | rien (état `non_configure`) | rien |
| Service worker absent au moment du clic | vrai | état `erreur` + Réessayer | rien |

Deux points méritent d'être explicités.

### 4.1 Le cas iOS est traité par construction, sans code spécifique

Sur iPhone et iPad, `PushManager` n'existe que dans l'application installée
(iOS 16.4+). Sans installation, `'PushManager' in window` est faux : la
fonctionnalité n'est donc jamais proposée, et le visiteur ne voit ni bouton ni
erreur. C'est exactement ce que demandait la consigne (« l'interface ne propose
simplement pas la fonctionnalité et rien ne casse ») — et cela ne demande aucune
détection de plateforme, donc aucune branche qui pourrait diverger.

### 4.2 Pas de fonctionnalité push dans une iframe

C'est la règle déjà posée par la tâche 6.4 pour le service worker : le widget
tourne sur des sites tiers, et y enregistrer un service worker poserait un cache
sur le domaine de l'hôte pour un document qu'il n'a pas demandé. Le push n'y
échappe pas — le navigateur refuse d'ailleurs `requestPermission()` dans une
iframe cross-origin. La fonctionnalité vit donc dans l'application Mia ouverte
en plein document (installation ou ouverture directe), et le chemin pour y
arriver existe déjà : c'est l'invite d'installation de la tâche 6.4.

### 4.3 Le service worker doit être ACTIF, pas seulement enregistré

`pushManager.subscribe()` échoue sur un enregistrement en cours d'installation
(première visite). Le code attend donc un worker **actif**, avec un délai
maximal de 10 secondes : un service worker qui ne s'active jamais produit un
état `erreur` affichable, jamais un bouton qui reste bloqué.

---

## 5. Décisions

### 5.1 La clé publique vient du serveur, jamais du code

`PushManager.subscribe()` exige la clé publique VAPID. Elle est lue par
`GET /api/chatbot/push/config` à chaque activation. L'écrire en dur dans le
widget aurait imposé de republier le widget à chaque rotation de clés.

### 5.2 La clé est convertie en octets

`applicationServerKey` accepte la chaîne base64url ou des octets. Le widget
convertit en `Uint8Array` (`cleApplicationServerKey`) : c'est la forme canonique
de la spécification, et la seule qui ne dépende d'aucune tolérance d'analyse
selon les navigateurs. La conversion retire un remplissage déjà présent, comme
le fait le serveur — un test l'a d'ailleurs révélé : la première version
échouait sur une clé portant `==`.

### 5.3 Un abonnement déjà consenti est resynchronisé

`resynchroniserAbonnement()` réenregistre auprès du serveur un abonnement
**déjà consenti** (permission accordée, abonnement mémorisé), au chargement de
l'onglet Aide. Sans cela, une ligne serveur perdue (base restaurée, rotation de
clés) ferait cesser les notifications sans que personne ne le sache. Ce n'est
pas une demande déguisée : aucune permission n'est sollicitée, rien n'est
affiché, et un test vérifie qu'un visiteur qui n'a jamais activé les
notifications ne déclenche **aucune** requête.

### 5.4 « Réglage » plutôt que « réglages »

Le bloc vit à la fin de l'onglet Aide, après la base de connaissances : c'est un
réglage, il ne passe pas devant le contenu. Il ne s'affiche que quand il a
quelque chose à dire, et il tient sur une carte unique (titre, phrase, action) —
aucun bandeau, aucune invite.

### 5.5 Aucune couleur littérale, aucun emoji

Le bloc n'utilise que des jetons (`--card`, `--border`, `--gold`, `--gold-bg`,
`--on-gold`, `--arrondi-bloc`, `--arrondi-bouton`, `--t`, `--ease-out`). Mesuré :
**0 valeur hexadécimale et 0 `rgb()`/`rgba()`** dans les fichiers livrés, et
**0 ajout** de couleur littérale dans le diff. Le compte de la tâche 6.3 (0 dans
les composants `.vue`) est donc intact. Aucun emoji dans l'interface : un test le
vérifie explicitement.

### 5.6 Accessibilité

Le réglage est une `section` intitulée (`aria-labelledby`), l'action est un vrai
`<button type="button">`, le message d'état est en `role="status"` (donc annoncé
aux lecteurs d'écran), le bouton porte `aria-busy` et est neutralisé pendant
l'opération, et le focus visible est explicite (`outline` sur `--gold`). L'état
ne repose jamais sur la seule couleur : le titre, la phrase et le libellé du
bouton le disent aussi.

---

## 6. Tests

### 6.1 Suite complète, avant et après

| | Avant | Après |
|---|---|---|
| `npm test` | **219 passés**, 15 fichiers | **296 passés**, 17 fichiers |
| dont `src/helpers/push.spec.ts` | — | **53** |
| dont `src/components/notifications.spec.ts` | — | **24** |

Aucun test existant n'est modifié, aucun n'est ignoré.

### 6.2 Ce que couvrent les 77 nouveaux tests

| Groupe | Objet |
|---|---|
| Support du push (8) | iframe, contexte non sécurisé, `PushManager`/`serviceWorker`/`Notification` absents |
| Politique d'état (10) | les six états, y compris « refusé » qui prime sur un abonnement mémorisé |
| Clé publique → octets (4) | 65 octets, premier octet `0x04`, alphabet base64url, remplissage |
| Configuration serveur (5) | configurée, non configurée, erreur 500, panne réseau, valeur illisible |
| Activation (13) | consentement, refus, absence de clé, réutilisation d'un abonnement existant, échec serveur, absence de service worker |
| Désabonnement (5) | ordre serveur-avant-navigateur, échec partiel, idempotence |
| Resynchronisation (3) | rien sans consentement, rien sans permission, réenregistrement |
| Mémoire locale (4) | écriture, relecture, contenu illisible, stockage absent |
| Composant (24) | ce que le visiteur voit, ce que son clic déclenche, accessibilité, intégration dans l'onglet Aide |

### 6.3 Build et non-régression

```
$ npm run build
✓ built in 1.31s
dist/assets/main-CAl4em_R.js   86.54 kB │ gzip: 30.48 kB
✓ built in 70ms
dist/eperformance-sdk.js       13.97 kB │ gzip:  5.07 kB
```

Mesure du delta, faite sur une copie de travail de `HEAD` (worktree temporaire,
retiré ensuite) :

| | Avant | Après | Delta |
|---|---|---|---|
| `main` (widget) | 78,00 kB · gzip 27,97 kB | 86,54 kB · gzip 30,48 kB | +8,54 kB · +2,51 kB gzip |
| `eperformance-sdk.js` | 13,97 kB | 13,97 kB | **0** |

Le bundle reste loin de l'objectif de 150 kB de la documentation maître. Le SDK
est **inchangé** (aucun fichier de `src/sdk/` n'apparaît dans `git status`).

Non-régression vérifiée par les suites existantes, toutes vertes :

| Ce qui devait continuer de fonctionner | Suite | Résultat |
|---|---|---|
| Les 5 vues (Accueil, Messages, Conversation, Aide, Actualités) | `src/views/navigation.spec.ts` (9) | vert |
| Invite d'installation et écran hors-ligne | `src/helpers/pwa.spec.ts` (17) + `src/components/pwa.spec.ts` (8) | vert |
| Pages `application/` | `src/application/pages.spec.ts` (18) | vert |
| Mode iframe | `src/helpers/pwa.spec.ts` + un test dédié dans chacun des deux nouveaux fichiers | vert |
| Conversation, saisie, blocs A | `src/components/*.spec.ts` (34) | vert |
| Console d'administration | `src/admin/*.spec.ts` (48) | vert |
| SDK gelé | `src/sdk/sdk.spec.ts` (32) | vert |

---

## 7. La chaîne vérifiée contre l'API de production

L'endpoint backend est déployé (Railway, `https://web-production-4ab53.up.railway.app`).
Le code réel du widget a été exécuté contre lui, dans un test temporaire (fichier
supprimé ensuite, non versionné) :

```
CONFIG  : {"configure":false,"clePublique":null,"raison":"non configuré : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY manquant(s) — le propriétaire n'a pas encore créé les clés VAPID du push navigateur"}
ÉTAT    : non_configure
AFFICHÉ : non
```

Autrement dit : la chaîne complète fonctionne, et son état actuel est
**exactement** celui attendu tant que les clés VAPID n'existent pas — le
réglage ne s'affiche nulle part, et rien ne casse.

Ce qui n'a **pas** été fait, volontairement : aucun abonnement réel n'a été
envoyé à la production. Un abonnement de test y laisserait une ligne vivante
vers un endpoint inexistant, que l'envoi de notifications tenterait ensuite en
vain. La route d'abonnement est couverte localement (63 tests backend + les
tests de ce dépôt).

### 7.2 Après déploiement GitHub Pages

Le commit a été poussé sur `main`, le déclencheur `Deploy widget to GitHub
Pages` a rejoué l'installation, le build et la suite de tests, puis publié. Le
site sert bien la nouvelle version :

```
$ curl -s https://kstephane683.github.io/eperformance-widget/index.html | grep -o 'assets/main-[A-Za-z0-9_-]*\.js'
assets/main-CAl4em_R.js          ← le bundle construit localement, à l'octet près

$ curl -s .../assets/main-CAl4em_R.js | grep -c 'ep-notifs'                → 1
$ curl -s .../assets/main-CAl4em_R.js | grep -c '/api/chatbot/push/config' → 1
$ curl -s .../assets/main-CAl4em_R.js | grep -c 'Notifications refusées'   → 1

$ curl -s https://kstephane683.github.io/eperformance-widget/sw.js | grep -c "VERSION = 'mia-v1'"
1                                 ← le service worker de la tâche 6.4 est inchangé
```

---

## 8. Ce qui revient au propriétaire, et ce qui est bloqué

### 8.1 Rien n'est bloqué côté widget

Le code est complet et déployable en l'état : sans clé VAPID, il ne propose
rien. Aucune décision extérieure n'est nécessaire pour que le widget se
comporte correctement.

### 8.2 Ce qui revient au propriétaire

1. **Créer les clés VAPID** (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `VAPID_CONTACT`) dans les variables Railway — commande et piège de format au
   §7.1 et §7.2 du rapport backend. C'est la seule action qui manque pour que la
   chaîne s'allume de bout en bout.
2. **Vérifier l'état** : `GET /api/chatbot/push/config` doit alors répondre
   `"configure": true` avec une clé de 87 caractères. Si la réponse indique
   `clé privée PKCS8 (variable inversée ?)`, les deux lignes ont été
   interchangées — le widget ne proposera rien, et la valeur ne sera jamais
   publiée.
3. **Rien d'autre à faire côté widget** : le commit a été poussé sur `main`,
   GitHub Actions a rejoué `npm ci`, `npm run build` et `npm test`, puis publié
   sur GitHub Pages — vérifié, §7.2.
4. **Point d'attention sans rapport avec le push** : `GET /api/status` de la
   production annonce `"environment": "/etc/profile"` (`debug` est bien à
   `false`, donc les pages de documentation restent désactivées). La variable
   `ENV` de Railway contient visiblement autre chose qu'un nom
   d'environnement — c'est cosmétique, mais cela vaut une correction.

### 8.3 Limites connues, assumées

* La fonctionnalité n'est pas proposée dans l'iframe (règle 6.4, §4.2) : le
  visiteur d'un site hôte qui cherche les notifications ne les trouvera pas dans
  le widget encarté. Le chemin passe par l'application installée, et l'invite
  d'installation existante est le seul point d'entrée — c'est le compromis
  retenu, conforme à la consigne « l'interface ne propose simplement pas la
  fonctionnalité ».
* Un abonnement peut rester actif côté serveur si le visiteur efface les
  données du navigateur : la ligne reste alors vivante jusqu'à ce que le service
  de push la déclare expirée. Le désabonnement explicite est le seul chemin
  garanti.
* La resynchronisation a lieu à l'ouverture de l'onglet Aide, pas au démarrage
  du widget : un visiteur qui n'ouvre jamais cet onglet ne resynchronise pas.
  C'est volontaire — aucune requête ne doit partir sans raison visible.

---

## 9. Vérifications de sortie

```
$ npm test
 Test Files  17 passed (17)
      Tests  296 passed (296)

$ npm run build
✓ built in 1.31s        (widget : main 86,54 kB · gzip 30,48 kB)
✓ built in 70ms         (SDK : 13,97 kB · inchangé)
```

### Commit et déploiement

Un seul commit, un seul sujet, poussé sur `main` :

```
a04869b feat(push): abonnement aux notifications après consentement explicite
```

```
$ git push origin main
To https://github.com/Kstephane683/eperformance-widget.git
   a57ece3..a04869b  main -> main

$ gh run list --limit 1
completed  success  feat(push): abonnement aux notifications après consentement explicite
                    Deploy widget to GitHub Pages   main   push   45s
```

Le déclencheur rejoue `npm ci`, `npm run build` **et** `npm test` avant de
publier : la suite complète est donc rejouée en intégration continue, sur la
version exacte publiée. Aucune dépendance n'est ajoutée par cette tâche
(`package.json` n'est pas modifié), donc `npm ci` reste reproductible.
