# Tâche 6.2-bis — structure fonctionnelle du chatbot Intercom + correctif `.sticky-cta`

**Date :** 18 septembre 2026 · **Périmètre :** widget `eperformance-widget`, SDK d'injection,
script d'index du blog · **Hors périmètre (non touché) :** site ePerformance, backend Railway,
automatisation du blog.

---

## 1. Ce qui est livré

### 1.1 Structure à 4 onglets + écran Conversation

| Écran | Route | Fichier | Contenu |
|---|---|---|---|
| Accueil (défaut à l'ouverture) | `#/` | `src/views/Home.vue` | « Bonjour », « En quoi pouvons-nous vous être utile ? », carte « Poser une question » (ouvre la conversation, focus dans le champ), article vedette (dernier publié du blog), 5 suggestions qui envoient leur libellé à Mia |
| Messages | `#/messages` | `src/views/Messages.vue` | liste des conversations : avatar, titre (Mia / « Mia et un conseiller »), aperçu du dernier message, date relative, chevron |
| Aide | `#/aide` | `src/views/Help.vue` | recherche « Trouver une réponse », « N collections », collections → articles → article sur le blog |
| Actualités | `#/actualites` | `src/views/News.vue` | « Actualités », « Les plus récentes », section « De l'équipe ePerformance », cartes (aperçu, tags, titre, description, flèche) |
| Conversation | `#/conversation` | `src/views/Conversation.vue` | fil de messages, indicateur de frappe, quick replies, zone de saisie complète |

Composants : `AppHeader.vue` (deux variantes — logo + équipe + fermer / retour + avatar Mia +
sous-titre « Agent IA · en ligne » + menu ⋯ + fermer), `TabBar.vue`, `BrandLogo.vue` (logo SVG),
`ArticleCard.vue`, `ChatInput.vue`, `ChatMessages.vue`, `MessageBubble.vue`, `QuickReplies.vue`,
`TypingIndicator.vue`. `ChatHeader.vue` est supprimé (remplacé par `AppHeader.vue`).

Stores/helpers : `stores/blog.ts` (index du blog), `stores/intent.ts` (intentions
Accueil → Conversation), `helpers/relativeTime.ts`, `helpers/speech.ts`,
`helpers/iconesCollections.ts`, `components/ChatInput.spec.ts`, `views/navigation.spec.ts`.

**Design system** : uniquement des jetons canoniques (`--bg`, `--card`, `--card2`, `--gold`,
`--on-gold`, `--border`, `--border-strong`, `--police-titres`, `--police-corps`, `--arrondi-*`,
`--t`, `--ease-out`, `--shadow-*`). Chaque composant cite la recette d'`eperf.css` qu'il reprend
(`.card`, `.post`, `.post-cat`, `.btn-outline`, `.theme-toggle`, `.quote-avatar`, `.section-rule`,
`.eyebrow`, `.site-header`, `.wa-float`). Aucune valeur inventée, aucun `--ep-*` résiduel,
**aucun emoji d'interface**, icônes SVG décrites par leurs tracés (jamais de `v-html` d'icône).

**Accessibilité** : `role="tablist"` / `role="tab"` / `role="tabpanel"` avec `aria-selected`,
`aria-controls`, `aria-labelledby`, tabindex mobile et navigation clavier ← → Début/Fin ;
`role="log"` + `aria-live="polite"` sur le fil ; `aria-disabled` + infobulle + description
lecteur d'écran sur le GIF et la dictée indisponibles ; focus visible (anneau or) ; contrastes
issus des jetons (AAA sur le corps, AA+ sur l'accent D6) ; `prefers-reduced-motion` respecté.

### 1.2 Zone de saisie (écran Conversation)

- **Pièce jointe** (`<input type="file">`) : aperçu local en data URL pour une image, nom du
  fichier affiché puis envoyé dans le texte du message. **Aucune persistance backend** : le
  contrat V2 n'expose aucun endpoint d'upload (décision #5) — le fichier ne quitte jamais le
  navigateur, seul son nom part. Documenté dans `ChatInput.vue` et `types/api.ts`.
- **Emoji** : sélecteur conservé (12 emojis rapides), inséré dans le champ.
- **GIF** : **écart assumé** — une recherche de GIF impose une dépendance externe
  (Giphy/Tenor) et des contenus sous licence. L'icône est présente, `aria-disabled="true"`,
  infobulle « Recherche de GIF indisponible dans cette version » et phrase dédiée aux lecteurs
  d'écran. Aucune UI factice.
- **Micro** : Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`), transcription
  dans le champ (résultats intermédiaires puis finaux), autorisation demandée par le navigateur,
  messages d'erreur explicites (`not-allowed`, `no-speech`), dégradation propre
  (`aria-disabled` + infobulle) si l'API est absente — le cas de Firefox.
- Lien « Politique de confidentialité » sous la zone
  (`https://eperformance.pro/politique-confidentialite.html`, nouvel onglet).

### 1.3 Index du blog (`chatbot-index.json`)

- Script : `blog-eperformance/_build/generer_index_chatbot.py` (docstring complète,
  `--copie-widget <dépôt>`, `--check` pour la CI).
- Sources, aucune donnée inventée : `_schedule.json` (drapeau `published`), chaque
  `articles/<slug>/index.html` (`<title>`, `<meta name="description">`, JSON-LD `Article` :
  `headline`, `description`, `datePublished`, `articleSection`, `keywords`, `og:image`), les
  4 pages de tête pour le titre et l'URL des collections.
- **Garde-fou avant-première** : un article n'est indexé que s'il est `published: true` **et**
  sans `noindex`. 8 articles publiés indexés, 4 collections (« IA générative » 5, « Acquisition » 1,
  « SEO » 1, « Site Web » 1). Les 73 articles non publiés sont absents.
- **Date retenue** : `datePublished` du JSON-LD (celle que le blog affiche sur ses cartes et ses
  pages), repli sur la date/heure de `_schedule.json`. Les deux sources donnent le même ordre.
- Publié avec le blog et **vérifié en ligne** :
  `https://blog.eperformance.pro/chatbot-index.json` → HTTP 200, 8 articles, 4 collections.
- Côté widget : fetch au chargement des onglets Aide/Actualités, **repli sur la copie embarquée**
  (`src/data/chatbot-index.json`, 6,5 Ko, données publiques uniquement) si le réseau échoue
  (CORS, hors ligne), 404 ou charge invalide — l'interface reste utilisable et l'affiche
  (« Version hors ligne… »).

---

## 2. Bug `.sticky-cta` — décision, mesures, correctif

### 2.1 Reproduction

Harnais `docs/phase3-tache-6-2-bis/hote-mobile.html` : page hôte réelle (feuille `eperf.css` du
site, balisage `.sticky-cta` identique, bouton WhatsApp, bandeau de consentement), widget chargé
par le SDK. Le SDK d'avant correctif est conservé (`sdk-ee30bc4-avant-correctif.js`, construit
depuis le commit `ee30bc4`) et sélectionnable par `?sdk=avant` — la comparaison porte donc sur du
code réel, pas sur une simulation.

**Avant** : la bulle (`bottom: 20px`, `z-index` 2 147 483 001) recouvrait le bouton WhatsApp de la
barre CTA (`z-index` 90) → bouton inutilisable (voir `bug-avant-375x667.png`).

| Gabarit | Hauteur barre CTA | Chevauchement bulle ↔ bouton WhatsApp | Chevauchement bulle ↔ barre |
|---|---|---|---|
| iPhone 14 Pro Max 430×932 | 78 px | **2 430 px²** | 3 136 px² |
| iPhone SE 375×667 | 103 px | **3 024 px²** | 3 136 px² |
| Galaxy S20 360×800 | 103 px | **3 024 px²** | 3 136 px² |
| 390×844 | 78 px | **2 430 px²** | 3 136 px² |

### 2.2 Décision

**La barre CTA reste visible et cliquable ; le widget se décale au-dessus.** Justification :
la barre porte l'action commerciale principale sur mobile (« Diagnostic gratuit » + WhatsApp) et
le site la considère comme prioritaire ; la masquer reviendrait à retirer un point de contact au
profit d'un widget dont l'ouverture est, elle, à l'initiative du visiteur. C'est aussi la
recommandation de la consigne.

Règle appliquée :

- **chat fermé** : la bulle (et la bulle d'accroche) remontent de la **hauteur réelle mesurée** de
  la barre + 8 px de respiration ;
- **chat ouvert en mobile (< 668 px)** : plein écran → aucun conflit, la bulle est masquée ;
- **669–720 px** (barre CTA visible, panneau non plein écran) : le panneau suit le même décalage
  pour ne jamais recouvrir la barre ;
- **desktop (> 720 px)** : la barre est masquée par le site → décalage nul.

Mise en œuvre dans `src/sdk/entry.ts` (`initStickyCtaGuard`), sur le modèle de la garde `.consent`
(D9) : mesure via `getBoundingClientRect`, recalcul groupé par frame, `MutationObserver` sur
`body` (apparition/disparition/masquage), `ResizeObserver` sur la barre (changement de hauteur),
`resize`/`orientationchange`. Valeur posée sur les éléments du SDK via `--ep-sdk-cta-offset`,
consommée par `bottom: calc(20px + var(--ep-sdk-cta-offset, 0px))` (bulle) et
`calc(88px + …)` (panneau, accroche).

### 2.3 Après correctif — mesures

| Gabarit | `bottom` calculé de la bulle | Chevauchement WhatsApp | Chevauchement barre |
|---|---|---|---|
| 430×932 (barre 78 px) | 106 px | **0 px²** | **0 px²** |
| 375×667 (barre 103 px) | 131 px | **0 px²** | **0 px²** |
| 360×800 (barre 103 px) | 131 px | **0 px²** | **0 px²** |
| 390×844 (barre 78 px) | 106 px | **0 px²** | **0 px²** |

Preuves : `bug-apres-*.png` (à comparer à `bug-avant-*.png`), `mesures-sticky-cta.json`.

### 2.4 Vérification en production (site + blog réels, SDK déployé)

| Page (mobile) | Barre CTA | `bottom` bulle | Chevauchement |
|---|---|---|---|
| https://eperformance.pro/ 390×844 | 78 px | 106 px | 0 px² (WhatsApp et barre) |
| https://blog.eperformance.pro/ 390×844 | 78 px | 106 px | 0 px² |
| https://blog.eperformance.pro/articles/chatbot-ia-repondre-site/ 375×667 | 78 px | 106 px | 0 px² |

Captures : `production-site-mobile-390x844.png`, `production-blog-mobile-390x844.png`.
Note : sur un premier chargement, la bulle est masquée tant que le bandeau de consentement est
affiché (comportement D9 voulu) ; la mesure a été faite après un choix explicite.

---

## 3. Défaut découvert et corrigé en cours de route

Un message créé quelques millisecondes **après** le montage du fil portait un horodatage
postérieur à l'horloge de la vue : il était traité comme « dans le futur » et affichait une date
en clair (« 18 sept. ») au lieu de « à l'instant ». Corrigé dans `helpers/relativeTime.ts`
(tolérance de 60 s vers l'avant, qui couvre aussi la dérive d'un horodatage serveur), avec deux
tests de non-régression. Visible en comparant les captures de conversation avant/après la
correction.

Second écart détecté par les captures : le widget se croyait « mobile » dans son iframe de 400 px
sur desktop, et gardait donc la barre d'onglets sur l'écran Conversation. Le SDK mesure
désormais le gabarit de la **fenêtre hôte** et le transmet (query param `viewport` au chargement,
postMessage `viewport` à chaque franchissement) ; la consigne est respectée : barre d'onglets
conservée en mobile, retour du header en desktop.

---

## 4. Tests et build

- **`npm test` : 90 tests verts** (42 avant la tâche), 6 fichiers :
  `stores/stores.spec.ts` (24), `sdk/sdk.spec.ts` (25), `stores/blog.spec.ts` (12),
  `components/ChatInput.spec.ts` (8), `views/navigation.spec.ts` (9),
  `helpers/helpers.spec.ts` (12).
  Nouveaux tests exigés par la consigne : navigation entre onglets (clic + clavier),
  désactivation du bouton d'envoi si vide, repli de l'index blog (réseau KO, HTTP 404, charge
  invalide), position de la bulle vs `.sticky-cta` (hauteur mesurée, barre absente, barre
  masquée, apparition/disparition, changement de hauteur), plus le pont `viewport`.
- **Build** : `vue-tsc -b` propre, `npm run build` OK (widget + SDK).
- **Tailles** : page widget **65 453 octets gzip** de JS (28 260 + 37 193) et 5,4 Ko gzip de CSS
  → **sous le plafond de 150 Ko** ; SDK **4 837 octets gzip** (13 535 brut) ; index embarqué
  6 471 octets. Aucune dépendance npm ajoutée.
- **Une exécution** de la suite a échoué une fois (1 test) sans être reproductible : 13 exécutions
  complètes suivantes vertes. Les tests de la garde `.sticky-cta`, sensibles au timing, ont été
  rendus robustes (`vi.waitFor`) ; aucune cause résiduelle identifiée.

---

## 5. Captures (`docs/phase3-tache-6-2-bis/`)

- 5 écrans × clair/sombre × desktop 1280×720 / mobile 390×844 :
  `clair-desktop-{accueil,messages,aide,aide-collection,actualites,conversation}.png`,
  `sombre-desktop-…`, `clair-mobile-…`, `sombre-mobile-…` (24 fichiers).
- Bug `.sticky-cta` : `bug-avant-{430x932,375x667,360x800,390x844}.png` et `bug-apres-…`
  + `mesures-sticky-cta.json`.
- Production : `production-site-mobile-390x844.png`, `production-site-mobile-aide.png`,
  `production-site-mobile-actualites.png`, `production-blog-mobile-390x844.png`.
- Outils : `captures.py` (serveur statique + proxy API local pour les captures),
  `hote-mobile.html` (harnais), `sdk-ee30bc4-avant-correctif.js` (SDK d'avant, pour la
  comparaison).

---

## 6. Écarts et limites — rien de masqué

1. **Émulateurs Android/iOS inutilisables ici** : SDK Android absent de la machine, iOS exige
   macOS/Xcode. La validation a été faite par **émulation de viewport dans un moteur réel**
   (Chromium/Playwright) aux dimensions demandées — suffisant pour la mise en page, la barre
   d'onglets, la zone de saisie et le chevauchement avec `.sticky-cta`. **Restent à valider sur
   appareil réel par l'utilisateur** : clavier iOS et ancrage `visualViewport`, safe-area réelles,
   dictée vocale mobile (permission et reconnaissance), partage de fichier depuis la galerie,
   comportement des liens `target="_blank"` dans une WebView.
2. **GIF** : non implémenté (dépendance externe + contenus sous licence) — icône visible,
   annoncée indisponible, aucune UI factice.
3. **Pièces jointes** : aucun envoi au serveur (pas d'endpoint au contrat V2). Seul le nom du
   fichier part dans le texte ; l'aperçu est local et perdu au rechargement.
4. **Avatars du header** : aucune photo n'est embarquée (poids du bundle, dépendance à une URL
   tierce) — trois pastilles d'initiales (Mia, K. Stéphane, équipe), langage visuel de
   `.quote-avatar` du blog. Identités publiques, aucune invention.
5. **Logo** : le site ne publie son logo qu'en WebP — le widget en contient une reprise
   **vectorielle** (marque + mot-symbole) qui suit le thème clair/sombre.
6. **Images d'articles** : le blog n'attache pas d'image aux articles ; l'aperçu des cartes est
   l'icône SVG de la collection, comme sur les cartes du blog. Le champ `image` reste dans
   l'index et s'affichera automatiquement si le blog en publie un jour.
7. **Liste des conversations** : une seule conversation (celle du visiteur), conformément à la
   v1 demandée ; la structure de liste est prête pour en accueillir plusieurs.
8. **Fraîcheur de l'index** : le workflow de publication planifiée du blog ne régénère pas
   encore `chatbot-index.json` (le dépôt blog n'a pas été modifié au-delà du script d'index).
   Tant que le script n'est pas branché, l'index reste celui du 18 septembre.

---

## 7. Déploiement

| Dépôt | Commit | État |
|---|---|---|
| `eperformance-widget` | `dc3c484` — « Phase 3 / Tâche 6.2-bis — structure Intercom à 4 onglets + correctif .sticky-cta » | poussé sur `main` |
| CDN | `npx gh-pages -d dist --dotfiles` + reconstruction Pages (`POST /pages/builds`) | **en ligne** |
| `blog-eperformance` | `9147215` — « feat(chatbot): index public chatbot-index.json… » | poussé sur `main`, index publié |

Vérifications en ligne : SDK `https://kstephane683.github.io/eperformance-widget/eperformance-sdk.js`
= 13 535 octets et contient `ep-sdk-cta-offset` (le correctif) ; bundle widget `main-6yFS1tlH.js`
(onglets) servi ; `https://blog.eperformance.pro/chatbot-index.json` → 200, 8 articles.

---

## 8. Prochaines étapes

1. Brancher `_build/generer_index_chatbot.py` à la fin du workflow de publication du blog
   (une commande + un commit) et/ou régénérer la copie embarquée du widget à chaque livraison.
2. Tests sur appareil réel (iOS + Android) des points listés en §6.1.
3. Décider du sort du GIF (fournisseur, budget licence) et, si un endpoint d'upload est ajouté au
   contrat V3, brancher les pièces jointes de bout en bout.
4. Envisager la réouverture de la conversation au dernier message non lu et la pagination de
   l'historique si le volume augmente.
