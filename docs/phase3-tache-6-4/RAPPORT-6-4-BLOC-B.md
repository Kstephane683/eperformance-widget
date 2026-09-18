# Tâche 6.4 — Bloc B : PWA Mia, pages publiques, wrapper natif (sans publication)

**Date :** 18 septembre 2026 · **Périmètre :** dépôt `eperformance-widget`
uniquement (widget Vue, SDK, pages publiques, documentation, harnais de preuve).
**Hors périmètre, non touché :** `unified-ia-backend/**`, `site-eperformance/**`
(hors l'entrée de journal du protocole), `blog-eperformance/**`,
`docker-unified/**`.

| Livrable | État | Preuve |
|---|---|---|
| A. PWA installable (manifeste, service worker, iOS/Android, détection d'environnement, invite non intrusive, hors ligne) | ✅ Fait | `public/mia-manifest.webmanifest`, `public/sw.js`, `src/components/InviteInstallation.vue`, `src/components/VoileHorsLigne.vue` |
| B. Page `/application/mia` (entrée Vite dédiée) | ✅ Fait | `application/mia/index.html`, `src/application.css`, captures `page-mia-*` |
| C. Portail `/application` | ✅ Fait | `application/index.html`, captures `page-portail-*` |
| D. Décision wrapper natif + configuration réelle | ✅ Fait, **aucune publication** | `twa-manifest.json`, `docs/phase3-tache-6-4/DECISION-WRAPPER-NATIF.md`, `native/README.md` |
| E. Assets de stores + checklists | ✅ Fait | `docs/phase3-tache-6-4/stores/**` |
| F. Tests, build, Lighthouse, captures, mesures | ✅ Fait | `mesures-invite-installation.json`, `lighthouse/scores.json`, 100+ captures |
| G. Coordination (journal, 2.1, suivi de lecture, DEMANDE, copie hors-site) | ✅ Fait | `site-eperformance/COORDINATION-AGENTS.md` |
| H. Ce rapport + commits | ✅ Fait | 7 commits dans `eperformance-widget` |

---

## 1. Non-régression — les chiffres

| Contrôle | Avant | Après |
|---|---|---|
| `npm test` (vitest) | **128/128** (8 fichiers) | **171/171** (11 fichiers) |
| `npm run build` (`vue-tsc -b` + `vite build` + `vite build --config vite.sdk.config.ts`) | ✅ | ✅ |
| CSS compilé du widget (jetons + recettes) | — | **identique à l'octet** pour le bloc de jetons extrait (1990 octets, comparaison avant/après sur `dist-avant`) |
| `node_modules` | — | **inchangé** (aucune dépendance ajoutée, ni runtime ni développement) |
| Bundle widget | 97,9 Ko (37,7 Ko gzip) | 97,2 Ko (37,4 Ko gzip) |
| Bundle SDK | 13,97 Ko (5,07 Ko gzip) | 13,97 Ko (5,07 Ko gzip) |
| Entrées HTML produites | `index.html`, `admin.html` | + `application/index.html`, `application/mia/index.html` |

Vérifications de non-régression ciblées, mesurées dans un vrai moteur de rendu
(`docs/phase3-tache-6-4/captures.py`) :

| Contrôle | Attendu | Mesuré |
|---|---|---|
| Bulle ↔ barre `.sticky-cta` (site hôte, 4 gabarits) | 0 px² | ✅ 0 px² sur 390×844, 414×896, 768×1024, 1440×900 |
| Invite ↔ zone de saisie `.ep-input-zone` | 0 px² | ✅ 0 px² (les quatre gabarits, mode application **et** iframe) |
| Invite ↔ bouton d'envoi `.ep-send` | 0 px² | ✅ 0 px² + bouton d'envoi atteint au hit-test |
| SDK : deux événements du contrat N3 | inchangés | ✅ `eperformance-sdk.js` non modifié |
| Mode iframe (widget sur site hôte) | inchangé | ✅ 40 captures avant/après, 5 écrans × 2 thèmes × 2 gabarits |

**Le SDK n'a pas été touché** : `src/sdk/entry.ts` est identique à la version
livrée en 6.3-BIS (`dist/eperformance-sdk.js` : même taille, même empreinte de
contenu). Le contrat N3 est intact par construction.

---

## 2. Ce qui a été fait — décisions et emplacements

### 2.1 Le widget devient aussi une application (sans changer dans l'iframe)

| Décision | Emplacement | Pourquoi |
|---|---|---|
| Le manifeste est lié dans `index.html`, l'application est le document lui-même | `index.html`, `public/mia-manifest.webmanifest` | Une seule base de code : ce qui est publié sur le web est ce que voit l'utilisateur de l'app. Le contenu (réponses de Mia) vient de l'API, pas du binaire. |
| `data-mode="application"` posé quand le document est de premier niveau | `index.html` (script bloquant), `src/style.css` | En iframe, le widget reste un panneau de 400 px ; ouvert directement, il devient une colonne centrée de 760 px. Aucune règle CSS ne s'applique dans l'iframe. |
| Le service worker **n'est jamais enregistré dans une iframe** | `src/helpers/pwa.ts` | Poser un cache au nom d'un site tiers pour un document qu'il n'a pas demandé serait une intrusion. |
| Le service worker **n'est jamais enregistré en développement** | idem | Sous `vite dev`, il servirait le dernier build et casserait le rechargement à chaud. |
| Jetons extraits en source unique | `src/styles/jetons.css` | Les pages publiques consomment les mêmes valeurs que le widget. Extraction vérifiée **identique à l'octet**. |

### 2.2 Service worker — la règle « jamais de réponse périmée »

`public/sw.js`, version `mia-v1` :

| Nature de la requête | Stratégie | Motif |
|---|---|---|
| Navigations (HTML) | **réseau d'abord**, cache en secours | On veut la dernière version de la page ; le cache ne sert qu'en coupure. |
| Ressources statiques (polices, icônes, images, JS/CSS fingerprintés) | **cache d'abord**, réseau en remplissage | Elles ne changent pas — c'est ce qui rend l'ouverture instantanée. |
| **Tout ce qui n'est pas de même origine** (l'API de Mia, sur Railway) | **aucune interception** | Le navigateur va au réseau, rien n'est mis en cache : une réponse de Mia ne peut pas être servie périmée. |
| `/api/…` sur notre origine, `admin.html` | **aucune interception** | Les données de la console sont authentifiées : elles ne sont pas mises en cache. |
| Méthode ≠ GET | aucune interception | `POST /message` ne se met pas en cache. |
| Activation | purge de tous les caches qui ne portent pas la version courante | Une seule version vit à la fois. |

Notifs (préparation 6.5) : un gestionnaire `push` et `notificationclick` sont en
place, sans effet tant qu'aucun abonnement n'existe — voir §5, point d'interface.

### 2.3 Invite d'installation — position et politique

`src/components/InviteInstallation.vue`, politique dans `src/helpers/installation.ts`.

- **Dans le flux**, entre le header et le contenu : le recouvrement avec la zone
  de saisie et le bouton d'envoi est **impossible par construction**, et mesuré à
  **0 px²** sur les quatre gabarits demandés, en mode application comme en iframe.
  Un bandeau flottant aurait exigé de recalculer sa position à chaque ouverture
  du clavier — précisément le défaut corrigé en 6.2-BIS sur `.sticky-cta`.
- **Jamais au premier chargement** : deux visites minimum, plus 12 s après le
  montage.
- **Jamais pendant une conversation** : l'écran Conversation et tout fil
  comportant un message du visiteur sont exclus.
- **Refus mémorisé 30 jours**, installation mémorisée définitivement.
- **Rien si l'application est déjà installée** (`display-mode: standalone`).
- Dans une iframe, le bouton conduit à `/application/mia` : le manifeste pris en
  compte depuis l'iframe serait celui du **site hôte** (le site a le sien) —
  installer depuis le widget installerait eperformance.pro, pas Mia.

### 2.4 Écran hors-ligne

`src/components/VoileHorsLigne.vue` + `src/helpers/reseau.ts` : la conversation
reste montée (aucune perte de fil), le contenu devient `inert` (le focus ne
passe pas derrière), le retour est **automatique** au retour du réseau, sans
rechargement ni action demandée. Coupure réseau **réelle** dans les preuves
(`context.set_offline(True)`), pas simulée par une variable.

### 2.5 Pages publiques

`application/index.html` (portail) et `application/mia/index.html` (page de
présentation) sont des entrées Vite dédiées (`vite.config.ts`), **sans Vue** :
le contenu est dans le balisage, donc lisible sans JavaScript et indexable.

Contenu de `/application/mia` : titre, promesse et **les deux boutons**
(« Ouvrir Mia », « Installer l’application ») dans le premier écran à 390 px
comme à 1440 px ; les **neuf capacités** (reprises de `src/data/capacites.ts`,
avec un test qui compare le balisage au fichier) ; une **FAQ** de six questions
(dont le JSON-LD `FAQPage` reprend exactement les questions affichées) ; une
**preuve visuelle** prise dans l'application réelle ; l'installation expliquée
pour iPhone, Android et ordinateur.

Zéro dépendance ajoutée, aucune police ni script externe : les polices sont
celles de `public/fonts/` (auto-hébergées), les couleurs celles des jetons
canoniques, les recettes celles des composants du site (boutons, cartes, FAQ,
filet de section, bascule de thème — références `eperf.css` en commentaire).

### 2.6 Wrapper natif — décision

Décision argumentée dans `docs/phase3-tache-6-4/DECISION-WRAPPER-NATIF.md` :

- **Android : Bubblewrap / TWA** (configuration réelle `twa-manifest.json`) —
  la PWA existe déjà, l'application n'en est qu'un habillage vérifié par Digital
  Asset Links : une seule base de code, mise à jour continue sans revue de store.
- **iOS : aucun wrapper en v1** — un habillage intégralement web est refusé
  (règle Apple 4.2), et le document maître situe le natif en v2 ; iOS utilise la
  PWA installée depuis Safari.
- **Notifications : Web Push standard (VAPID)**, transporté par FCM
  (Chrome/Android) et APNs (iOS installé) — pas d'OneSignal (SDK tiers, coût,
  et page cookies du site à rouvrir).

**Aucun binaire compilé, aucun compte créé, rien publié.**

### 2.7 Assets de stores

`docs/phase3-tache-6-4/stores/` : icône Play 512×512, graphique 1024×500 sans
transparence, 4 captures téléphone 1080×1920, 4 captures 7 pouces, 4 captures
10 pouces, icône App Store 1024×1024 et 4 captures 6,9 pouces 1320×2868.
Descriptions courte et longue, mots-clés, catégorie et réponses du formulaire
« Sécurité des données » : `DESCRIPTIONS.md`. Checklists de soumission :
`CHECKLIST-PLAY.md`, `CHECKLIST-APP-STORE.md`.

**Les captures montrent de vraies réponses de Mia** : le harnais relaie l'API de
production (le backend n'autorise pas l'origine `127.0.0.1`) — la réponse est
celle du backend, seule la transportée est locale. Une capture montrant un
message d'indisponibilité est un motif de rejet en revue.

---

## 3. Mesures

### 3.1 Invite d'installation — surfaces de recouvrement (px²)

Méthode identique à celle de la tâche 6.2-BIS pour `.sticky-cta` : rectangles
relevés au `getBoundingClientRect()`, intersection en pixels carrés, plus un
hit-test au centre du bouton d'envoi.

<!-- MESURES_INVITE -->

### 3.2 Lighthouse (mesuré, rapports conservés)

<!-- MESURES_LIGHTHOUSE -->

### 3.3 Manifeste lu par Chromium (`Page.getAppManifest`)

<!-- MESURES_MANIFESTE -->

---

## 4. Ce qui reste au propriétaire

| # | Action | Nature | Bloquant pour |
|---|---|---|---|
| 1 | Réserver `mia.eperformance.pro` (DNS + domaine personnalisé GitHub Pages) | Décision + DNS | Un TWA **vérifié** (sans lui : APK de test avec barre d'adresse) |
| 2 | Créer la clé de signature, la sauvegarder hors dépôt, publier l'empreinte dans `public/.well-known/assetlinks.json` | Secret | La vérification Digital Asset Links |
| 3 | Compte Google Play (25 USD), compilation `bubblewrap build`, fiche, questionnaire de sécurité des données | Compte payant + publication | La présence sur le Play Store |
| 4 | Compte Apple (99 USD/an) — **inutile en v1** | Compte payant | Rien aujourd'hui ; la v2 native |
| 5 | Clés VAPID + `pywebpush` côté backend, abonnement push côté widget | Configuration | Les notifications push (tâche 6.5, périmètre backend) |
| 6 | Lien depuis `eperformance.pro` vers `/application` et `/application/mia` | Périmètre SITE | La découvrabilité des pages |
| 7 | Emoji dans le message d'accueil de Mia (`src/stores/messages.ts:53`) et dans certaines réponses du backend | Arbitrage sur la règle n°8 | Rien — **mais à trancher** (voir §6) |

---

## 5. Bloqué, et pourquoi

| Point | État | Ce qu'il faudrait |
|---|---|---|
| Compilation iOS | **Impossible ici** | Un Mac avec Xcode (ou un runner macOS). Non contournable. |
| TWA vérifié | **Bloqué** | Le sous-domaine (action 1 ci-dessus). Un TWA ne peut pas s'authentifier sur `github.io`. |
| Notifications push de bout en bout | **Interface manquante** | Le service worker gère déjà l'événement `push`, le backend sait envoyer (6.5). Il manque **l'abonnement côté widget** (`PushManager.subscribe`) et l'endpoint qui l'enregistre. Proposition d'interface dans le journal de coordination — à trancher avec l'agent BACKEND, je n'arbitre pas seul. |
| `assetlinks.json` déployé | **Volontairement absent** | Il doit porter une empreinte SHA-256 réelle, connue seulement après création de la clé. Un fichier à empreinte fausse échoue **en silence**. |
| Rendu du store sur les 27 agents internes | **Non concerné** | Aucune page, aucun libellé, aucune métadonnée ne les nomme : le test `pages.spec.ts` refuse les termes internes et les 40 captures le confirment. |

---

## 6. Conflits et points d'attention signalés (je n'arbitre pas seul)

1. **Règle n°8 (aucun emoji) et le message d'accueil.** Le message d'ouverture
   posé par le widget (tâche 6.3-BIS, A.4) contient un emoji :
   `src/stores/messages.ts:53` — « Bonjour 👋 Vous parlez maintenant avec Mia. ».
   Le backend en produit également dans certaines réponses (vérifié :
   « Bonjour ! 👋 »). La règle n°8 est appliquée dans **mes** livrables (pages,
   libellés, métadonnées PWA — un test le vérifie), mais ce texte
   conversationnel préexiste et il est documenté dans `ONBOARDING-MIA.md`.
   **Décision demandée au propriétaire** : étendre la règle au texte
   conversationnel (deux emplacements : `src/stores/messages.ts`, backend) ou la
   limiter aux libellés d'interface.
2. **Concurrence d'agents sur le même dépôt, le même soir.** Une autre session
   CHATBOT a livré les tâches **6.5** (notifications) et **6.8** (recherche blog)
   à 20:30, en modifiant `COORDINATION-AGENTS.md` pendant que je rédigeais la
   présente tâche. Vérifié : **le dépôt `eperformance-widget` n'a reçu aucune
   modification étrangère** (`git fetch` : `origin/main` inchangé, mes 7 commits
   sont les seuls en avance). Le journal a été rouvert avant écriture pour ne pas
   écraser leurs entrées. **Point de coordination réel** : ma décision
   « Web Push standard (VAPID) » s'aligne sur leur canal push, mais l'abonnement
   côté widget reste à faire (voir §5).
3. **Proposition du 18/09 16:30 annulée par cette tâche.** L'entrée précédente
   proposait de créer `application/index.html` et `application/mia/index.html`
   **dans le dépôt du site**. La présente tâche livre ces pages dans le dépôt du
   widget (entrées Vite) et ne touche **aucun** fichier du site : l'entrée de
   journal correspondante le dit explicitement, pour éviter deux écrivains sur le
   même chemin.
4. **Écart de jeton préexistant (hors périmètre).** `--arrondi-input` vaut 12 px
   dans le widget et 10 px dans `eperformance.pro` (`eperf.css:149`). Non
   modifié : le corriger changerait l'interface du widget en production, ce qui
   n'est pas l'objet de cette tâche.
5. **Favicon du widget.** `public/favicon.svg` est l'éclair violet du modèle
   Vite. Les pages publiques et l'application déclarent désormais les favicons de
   la marque (`favicon-32.png`, `favicon-16.png`) ; l'ancien fichier reste en
   place pour `admin.html`, hors périmètre.

---

## 7. Rejouer les preuves

```bash
cd /home/ballo/OX6A/toolkit_eperformance/eperformance-widget
npm test                       # 171/171
npm run build                  # vue-tsc + vite + sdk
python3 docs/phase3-tache-6-4/captures.py tout      # captures + mesures (≈ 15 min)
python3 docs/phase3-tache-6-4/lighthouse.py         # scores PWA/a11y/BP/SEO/perf
python3 docs/phase3-tache-6-4/generer-icones.py     # icônes (source : logo du site)
python3 docs/phase3-tache-6-4/stores/generer-assets.py   # visuels de stores
```

Tous les scripts écrivent uniquement dans ce dépôt (plus `public/preuves/` pour
les images déployées). Aucun n'écrit dans le site, le blog ou le backend.
