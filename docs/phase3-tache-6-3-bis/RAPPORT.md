# Tâche 6.3-BIS — Bloc A : 11 corrections du chatbot ePerformance

**Date :** 18 septembre 2026 · **Périmètre :** widget `eperformance-widget`
(Vue + SDK), backend FastAPI `unified-ia-backend` (Railway), personas d'agents,
documentation de contrat.
**Hors périmètre (non touché) :** `site-eperformance/**`,
`blog-eperformance/**`, `COORDINATION-AGENTS.md` (hors l'entrée de journal),
`scripts/verifier-chatbot.py`.

| Livrable | État |
|---|---|
| Code widget + backend, tests verts, build, déploiement | ✅ |
| `docs/phase3-tache-6-3-bis/RAPPORT.md` (ce document) | ✅ |
| `ONBOARDING-MIA.md` (dépôt widget) | ✅ |
| Contrat d'interface mis à jour | ✅ `CONTRAT-INTERFACE-V2.md` (V2.2) |
| Protocole de coordination + copies | ✅ |

**Commits :** backend `1d084bb` (déployé, SHA vérifié sur `GET /`) · widget
`b437ec9` + documentation `1100b63` (déployés sur GitHub Pages — l'asset servi
est `main-BGI3bbDR.js`, identique au build local) · coordination `81563e7`
(dépôt du site).
**Tests :** widget **128/128** (90 avant) · backend **95** (nouveaux) ·
site **16/16** · blog **88/88**.

---

## Synthèse des 11 corrections

| # | Correction | État | Preuve courte |
|---|---|---|---|
| A.1 | Vision DeepSeek (modèle + images) | ✅ | Modèle `deepseek-flash`, image décrite : « un aplat de vert foncé uni » — `e2e-live-resultats.json` |
| A.2 | Défilement onglet Actualités | ✅ | 2 198 px de contenu / 541 px visibles, `overflow-y:auto` — `mesures-defilement.json` |
| A.3 | Datation des messages visiteur | ✅ | « Bonjour » puis « Vous · à l'instant » sous la bulle — `A3A4A6-conversation-*.png` |
| A.4 | Premier message de Mia | ✅ | Posé à l'ouverture, une fois par session, signature `Mia • Agent IA • à l'instant` |
| A.5 | Suppression du script rigide | ✅ | Cause : `sales-discovery-coach.md` v1.0 ; réponse « Bonjour » naturelle en production |
| A.6 | Fuite du nom d'agent | ✅ | `MessageBubble.vue` + 24 personas ; `A6_fuites: []` en production |
| A.7 | Défilement suggestions desktop | ✅ | 1 205 px / 541 px visibles, `defilable:true` |
| A.8 | 9 suggestions enrichies | ✅ | 3 familles × 3, payload `[intent:…]`, clic tracé |
| A.9 | Onglet Aide enrichi | ✅ | « Ce que Mia peut faire pour vous » : 9 capacités cliquables |
| A.10 | `ONBOARDING-MIA.md` | ✅ | 6 sections (flux, 5 premiers messages, INTERDIT, ATTENDU, N3, où intervenir) |
| A.11 | Non-régression | ✅ | 16/16 · 88/88 · 128/128 · `/health` 200 · chevauchement 0 px² · Consent Mode v2 `denied` |
| N3 | Événements SDK (ajout coordinateur) | ✅ | `eperf:chatbot:message` / `eperf:chatbot:lead` émis, aucune donnée personnelle |

---

## A.1 — Vision DeepSeek

### Modèle : AVANT / APRÈS

| | Valeur | Emplacement |
|---|---|---|
| **AVANT** | `"model": "deepseek-chat"` — **écrit en dur deux fois** | `backend/core/llm_client.py` : `_call_deepseek` (l.242-247) et `_sync_deepseek_call` (`'model': 'deepseek-chat'`, l.285) |
| | URL en dur : `https://api.deepseek.com/v1/chat/completions` | `_sync_deepseek_call` |
| | Aucune variable `DEEPSEEK_MODEL` sur Railway (`railway variables` : absente) → **non surchargeable sans redéploiement** | — |
| **APRÈS** | `DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-flash")` | `backend/core/llm_client.py`, en tête de module |
| | `DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")` | idem |
| | `DEEPSEEK_REASONING_EFFORT = os.getenv("DEEPSEEK_REASONING_EFFORT", "none")` | idem |

Vérifié auprès du fournisseur : `deepseek-chat` est désormais **routé** vers
`deepseek-flash` (la réponse porte `"model": "deepseek-flash"`), et l'ID
explicite `deepseek-flash` est accepté sur `/v1/chat/completions` comme sur
`/chat/completions`.

**Piège traité :** `deepseek-flash` est un modèle de **raisonnement**. Il émet un
`reasoning_content` (brouillon) *avant* le `content`, et `max_tokens` couvre les
deux. Sans réglage, une réponse peut revenir **vide** avec `finish_reason=length`
— le code l'aurait prise pour une panne et aurait basculé silencieusement sur
Claude. D'où : `reasoning_effort=none` par défaut (surchargeable), un rejeu
automatique avec budget doublé si le contenu revient vide alors qu'un
raisonnement a été émis, et surtout : **`reasoning_content` n'est jamais
renvoyé** (ce serait le brouillon interne affiché au visiteur).

### Chemin complet de l'image (widget → backend → LLM)

| Étape | Fichier |
|---|---|
| Choix du fichier, lecture en data URL, marquage `estImage` | `src/components/ChatInput.vue` (`onFichier`) |
| Décodage en base64 + `media_type` + `detail` | `src/stores/messages.ts` (`imagePayloadDepuisDataUrl`) |
| Envoi sur le **dernier message** (`messages[-1].image`) | `src/api/railway.ts` |
| Validation et normalisation | `backend/chatbot/vision.py` (`preparer_image`) |
| Description par un appel dédié | `backend/chatbot/response_generator.py` (`_decrire_image`) |
| Reprise dans le message + cadre « IMAGE JOINTE » du prompt | `response_generator.py` (`_message_avec_observation`, `_get_vision_instructions`) |

Le contrat accepte **un champ optionnel `image` sur le dernier message**
(`{data, media_type, detail, name}`) — choix documenté dans
`CONTRAT-INTERFACE-V2.md` §1.2 : le format texte Deep Chat reste intact, le
champ est ignoré s'il est absent, et le widget ne joint jamais qu'une image.

**Formats :** JPEG, PNG, GIF, WebP **détectés par les magic bytes** (jamais par
l'extension ni par le `media_type` déclaré, qui est écrasé). Un `.png`
contenant du JPEG est traité comme du JPEG — testé. Un fichier HTML ou exécutable
renommé `photo.jpg` est **refusé en 400** avec un motif lisible.

**Budget :** grand côté ramené à **512 px** et 4 Mo maximum → ≤ 255 tokens
d'image en `detail:"high"`, 85 en `low`. Plafond de conception **~384
tokens/image**, tenu. `detail` (`low|high|auto`) est validé et transmis.

### L'écart qui a changé la conception : l'image est décrite par un appel dédié

Premier essai : l'image était passée **dans le message**, avec le prompt complet
de Mia (≈ 9 300 caractères : identité + persona + contexte + contraintes).
Résultat mesuré, sur une image unie de 512 px dont la couleur est connue :

| Configuration | Réponses (3 essais) |
|---|---|
| Prompt complet, image 96 px, `detail=high` | « Blanc. », « Blanc. », « Blanc. » |
| Prompt complet, image 512 px, `detail=high` | « Je vois une im… », « Je vois une im… », « Blanc. » |
| Prompt complet, image 1200×900 | « Vert », « Vert », « Vert » |
| Prompt **minimal**, image 512 px | « Vert », « Vert », « Vert » |

La lecture de l'image se perd dans un prompt long. L'implémentation retenue :
**un appel dédié, à prompt minimal**, qui produit une observation factuelle
(2-3 phrases, 400 tokens max), puis cette observation est injectée dans le
message sous `[Observation de l'image jointe]` et le cadre système dit au modèle
que l'observation est la sienne. Le chemin multimodal direct reste en **repli**
si l'appel de description échoue.

Conséquence documentée : **deux appels** par message avec image (~1 s de
latence supplémentaire, ~300 tokens).

### Test réel (production, via le widget déployé)

> **Image envoyée :** PNG 240×240, aplat vert (30, 150, 70).
> **Question :** « Qu'est-ce que tu penses de ce visuel pour ma page Facebook ? »
> **Réponse de Mia :** « Le visuel que tu m'envoies est un aplat de vert foncé
> uni — pas de texte, pas de logo, pas d'image. Donc en l'état, ce n'est pas un
> visuel de page Facebook : c'est un fond. […] Ça ne communique rien. Une
> bannière doit dire en 3 secondes : qui tu es, ce que tu fais, et ce que la
> personne doit faire ensuite. […] »

Elle **décrit** l'image et **répond à la question posée** — elle ne demande pas
au visiteur de la décrire. Sortie complète : `e2e-live-resultats.json`
(clé `A1_reponse_image`), capture `live-A1-image.png`.

---

## A.2 + A.7 — Défilement (même cause racine)

**Diagnostic.** `.ep-vue` (le conteneur de chaque écran) n'avait ni `flex: 1`,
ni `min-height: 0`, ni `overflow-y: auto`. Son parent `.ep-corps` étant en
`overflow: hidden`, tout contenu plus haut que la fenêtre était **coupé sans
recours** :

- **A.2** — la liste de l'onglet Actualités s'arrêtait au 2ᵉ article ;
- **A.7** — sur desktop (panneau de 650 px), les suggestions de l'accueil
  passaient sous le bord bas, inatteignables. En mobile plein écran (844 px) le
  contenu des 4 suggestions tenait, d'où l'impression que « ça marche en
  mobile ».

**Correction** (`src/style.css`) : `flex: 1; min-height: 0; overflow-y: auto;`
+ `scroll-behavior: smooth` (défilement doux, sans saut) +
`overscroll-behavior: contain` + scrollbar discrète (`scrollbar-width: thin`,
`::-webkit-scrollbar` 8 px, sans fond, `--border-strong`, `--muted` au survol).

**Mesures** (`mesures-defilement.json`, Chromium, build avant = `78ea5b8`) :

| Écran | Gabarit | AVANT | APRÈS |
|---|---|---|---|
| Actualités | desktop 1280×720 | 2 198 / 2 198 px · `overflow: visible` · **défilable : non** | 2 198 / **541** px · `overflow: auto` · **défilable : oui** |
| Actualités | mobile 390×844 | 2 198 / 2 198 · non | 2 198 / **735** · oui |
| Accueil | desktop | 809 / 809 · non | 1 205 / **541** · oui |
| Aide | desktop | 502 / 502 · non | 1 152 / **541** · oui |

Captures : `A2-actualites-{avant,apres}-{desktop,mobile}-{clair,sombre}.png` et
`A2-actualites-bas-*.png` (bas de liste atteint après correction), `A7-accueil-bas-*`.

**A.7 — les trois largeurs desktop demandées** (`mesures-largeurs-desktop.json`) :
le panneau garde la même géométrie (400 × 650 px) quelle que soit la largeur de
la fenêtre, mais la mesure confirme que le défilement fonctionne et que la
dernière suggestion est atteignable :

| Largeur | Contenu / visible | `overflow-y` | `scroll-behavior` | Défilement max | Dernière capacité atteignable |
|---|---|---|---|---|---|
| 1280 | 1 205 / 541 px | `auto` | `smooth` | 664 px (atteint) | ✅ |
| 1440 | 1 205 / 541 px | `auto` | `smooth` | 664 px (atteint) | ✅ |
| 1920 | 1 205 / 541 px | `auto` | `smooth` | 664 px (atteint) | ✅ |

Le défilement est **doux** (`scroll-behavior: smooth` mesuré) et sans saut : la
position progresse par animation, il n'y a pas de téléportation du contenu.

**Les 5 écrans × 2 gabarits × 2 thèmes** ont été parcourus (10 combinaisons) :
`A8-accueil`, `A2-actualites`, `A9-aide`, `A3A4A6-conversation` ×
`{avant,apres}` × `{desktop,mobile}` × `{clair,sombre}` = 48 captures. Les
écrans Messages et Conversation ont leur propre conteneur défilant
(`.ep-messages`), inchangé.

---

## A.3 — Datation des messages visiteur

**Cause.** La signature était en `display: inline-flex` alors que le contenu
d'une bulle visiteur est un simple nœud texte : les deux se posaient sur la même
ligne → « **Bonjourvous · il y a 2 minutes** ». Chez Mia, le contenu est un
`<div>` (rendu markdown), donc la signature passait bien en dessous.

**Correction.** Le texte de la bulle est désormais un élément de **bloc**
(`<p class="ep-bubble__texte">`) et la signature est en `display: flex` avec
`margin-top`. Elle est **toujours sous la bulle**.

**Format.** Conforme à la spécification, littéralement :
`Vous · à l'instant` / `Vous · il y a X minutes` (séparateur `·`, A.3) pour le
visiteur ; `Mia • Agent IA • il y a X minutes` (séparateur `•`, A.4) pour Mia.
La signature du visiteur est alignée à droite, l'heure exacte reste en infobulle.

**Preuve.** `A3A4A6-conversation-avant-desktop-clair.png` (« Bonjourvous • à
l'instant ») → `A3A4A6-conversation-apres-desktop-clair.png` (« Bonjour » puis
« Vous · à l'instant »). Tests : `src/components/blocA.spec.ts`, bloc
« A.3 — la signature est sous la bulle » (4 tests, dont la non-inclusion DOM).

---

## A.4 — Premier message de Mia à l'ouverture

**État initial.** Le message existait (6.2-bis) mais : (1) il n'était posé
qu'en arrivant sur l'écran Conversation, pas à l'ouverture du widget ; (2) sa
garde reposait sur « le fil est vide », donc toute remise à zéro du store dans
la même session le réaffichait ; (3) rien ne le réarmait explicitement après une
session expirée.

**Correction** (`src/stores/messages.ts` → `accueillirSiNecessaire`) :

- posé **dès le montage du widget** (`src/App.vue`), avant toute interaction ;
- **une seule fois par session** : clé `sessionStorage['eperf_mia_accueil']`
  (survit au rechargement de l'iframe) **et** drapeau mémoire (couvre le
  stockage bloqué) **et** garde « le fil contient déjà des messages » ;
- **réarmé sur session expirée** : `conversation.reset()` (404 serveur,
  nouvelle conversation) efface le verrou — Mia se présente de nouveau ;
- **jamais** s'il existe une conversation à reprendre.

Texte : « Bonjour 👋 Vous parlez maintenant avec Mia. Comment puis-je vous
aider ? » — signature `Mia • Agent IA • à l'instant`. Ce n'est pas une réponse :
il est écrit localement, pas généré.

**Preuve.** `e2e-live-resultats.json` → `A4_message_ouverture` :
« Bonjour 👋 … \n\nMia • Agent IA • à l'instant ». Tests : 5 tests dédiés
(`blocA.spec.ts`), dont « ne se redéclenche pas après un rechargement du
widget » (nouvelle instance de store) et « revient sur une session expirée ».

---

## A.5 — Suppression du script rigide

### Source localisée

**`backend/chatbot/agents/sales/sales-discovery-coach.md` v1.0** — l'agent par
défaut des intents `greeting`, `general_question` et `fallback`. Trois sections
produisaient le script :

1. `### Framework SPIN (Ordre Strict)` — la liste des questions à poser **dans
   l'ordre** (« Tu es dans quel secteur d'activité ? », « Quel est ton plus gros
   blocage ? »…) ;
2. `### Structure de Réponse` — un gabarit numéroté en trois temps
   (`1. [Reformuler] 2. [Poser UNE question SPIN] 3. [Encouragement]`) ;
3. `## Exemples de Réponses` — quatre échanges **entièrement rédigés**, dont
   « Exemple 1 : Découverte initiale » qui est, mot pour mot, le message observé
   en production.

S'y ajoutaient, dans `response_generator.py` : `_get_intent_instructions`
(listes de questions « à poser » par intent) et `_get_general_constraints`
(« Bullets points si liste », « Appel à l'action clair à la fin de chaque
réponse »).

### Réponse AVANT (production, 18/09/2026, `POST /api/chatbot/message`, « Bonjour »)

> Bonjour ! 👋 Je suis Mia, coach en découverte commerciale chez ePerformance.
> Mon rôle : comprendre ton business et ton plus gros blocage pour te proposer la
> solution la plus adaptée. Pour bien t'orienter, dis-moi : **1. Tu es dans quel
> secteur ?** (MLM, e-commerce, services, restauration…) **2. Quel est ton plus
> gros défi en ce moment ?** Prends ton temps, je t'écoute 👂

### Réponse APRÈS (production, même message, même heure)

> Bonjour 👋 Dis-moi ce qui t'amène — tu es en train de lancer une activité, tu
> cherches à générer plus de clients, ou tu as une question précise ?

### Correction

- Persona **réécrit en principes** (v2.0) : ce que Mia cherche à comprendre
  (situation, problème, enjeu, décision) décrit comme des *zones d'ombre à
  lever* — « Tu n'as pas de liste à dérouler » —, comment elle mène l'échange,
  quand le visiteur est prêt, et une liste d'interdits. Le canevas, la structure
  numérotée et les exemples rédigés sont supprimés ; une note de maintenance
  explique pourquoi (pour que personne ne les réintroduise).
- `_get_intent_instructions` : chaque entrée dit **ce qu'il faut obtenir** et à
  quoi ressemble une réponse de qualité — plus aucune liste de questions.
  Les 9 intents d'A.8 y ont leur propre entrée (« compétence à démontrer »).
- `_get_general_constraints` : contraintes de **qualité** et interdits ; la
  forme est rendue au modèle (« Adapte la forme au message reçu »).

**Test :** `test_plus_de_canevas_spin_ni_de_structure_numerotee` vérifie que les
sections ont disparu et que le rôle reste décrit en principes.

---

## A.6 — Fuite du nom d'agent

### Source localisée (front)

`src/components/MessageBubble.vue`, lignes 24-26 : un
`<span class="ep-bubble__meta">{{ agentLabel }}</span>` affichait la clé
d'agent transformée en libellé lisible (`sales-discovery-coach` →
« discovery coach »), plus la propriété calculée `agentLabel` (lignes 120-125) et
la règle CSS `.ep-bubble__meta`. **Visible en production** :
`A3A4A6-conversation-avant-desktop-clair.png` montre « discovery coach » sous la
réponse de Mia.

### Audit complet

| Zone | Constat | Action |
|---|---|---|
| Widget : affichage | `agentLabel` + `.ep-bubble__meta` | **Supprimés** (gabarit, script, CSS) |
| Widget : données | `message.agent_used` | **Conservé** dans le fil (observabilité, tests) mais plus jamais rendu |
| Widget : signature | `signature` | Affiche `Mia` quel que soit l'agent |
| Backend : réponse | `metadata.agent_used` | **Conservé** (dashboard, analytics, `suggestion_click`) — le front ne l'affiche plus |
| Backend : prompts | 24 personas se nommaient **Marc, Sarah, David, Moussa, Ibrahim, Karim, Aïcha, Fatima, Mariama, Aissatou, Boubacar, Abdoul, Amina, Ousmane, Sekou, Mariam, Salimata, Ibrahima, Fatoumata, Youssef, Khadija, Amadou, Ndeye** — et un persona (`customer_support`) faisait **transférer vers des collègues nommés** | Identité normalisée en **Mia** dans les 27 fichiers ; phrases de transfert anonymisées (« un conseiller ePerformance reprend avec toi ») |
| Backend : persona | `sales-discovery-coach` faisait dire « Je te passe **Marc**, notre expert sales » | Supprimé (persona réécrit) |
| Backend : logs | `logger.info(... Agent: {agent_used} ...)` | **Conservé** — logs serveur, jamais exposés au visiteur |

### Trois garde-fous (défense en profondeur)

1. **Prompt** — `_get_identity_block()` place la règle d'identité **en tête** du
   prompt système, avant le persona : « Tu t'appelles **Mia**. C'est le SEUL nom
   que tu prononces pour te désigner », avec les interdits explicites et les
   clés techniques citées comme telles. Un persona qui nommerait un agent ne
   peut plus l'emporter sur cette règle.
2. **Personas** — 27 fichiers nettoyés (test paramétré sur 23 prénoms).
3. **Sortie** — `_neutraliser_noms_agents()` retire les 21 motifs de clés
   d'agent du texte **avant** l'écriture en base et l'envoi au widget. C'est le
   dernier point où l'on peut rattraper une fuite.

**Test exhaustif des 27 agents** : `blocA.spec.ts` monte une bulle pour chacune
des 27 clés d'agent et vérifie que le texte rendu contient « Mia » et **ne
contient ni la clé, ni la clé avec des espaces**. En production : `A6_fuites: []`
(aucune des 6 chaînes recherchées dans le fil réel).

---

## A.8 — Neuf suggestions enrichies

### Structure livrée

| Famille | Capacités (libellé → clé) |
|---|---|
| Développer mon activité | Trouver plus de clients → `clients` · Développer mon MLM / parrainage → `mlm` · Améliorer mes ventes → `ventes` |
| Visibilité & Acquisition | Créer un site web qui convertit → `site_web` · Améliorer mon référencement → `seo` · Lancer une campagne publicitaire → `ads` · Gérer mes réseaux sociaux → `social` |
| Automatisation & IA | Exploiter l'IA et l'automatisation → `ia_auto` · Optimiser mon tunnel de conversion → `funnel` |

Source unique : `src/data/capacites.ts` (libellés, clés, icônes SVG en tracés
clairs — aucun emoji d'interface, aucun `v-html`). « Trouver une réponse »
(recherche libre) reste **en haut**, détachée visuellement des capacités.
**Écart assumé :** l'article vedette a été déplacé **après** les capacités — dans
un panneau desktop de 650 px, sa carte (~300 px) repoussait les neuf capacités
sous la ligne de flottaison, alors que ce sont elles qui montrent les
compétences. Structure Intercom conservée, seul l'ordre change.

### Implémentation du contrat

- `data-suggestion="<intent>"` + `data-label="<libellé>"` sur chaque bouton.
- Au clic : le widget envoie **`[intent:<intent>] <libellé>`** au backend.
  **La bulle affiche le libellé seul** (le préfixe est une notation interne,
  jamais montrée) : `App.vue`/`Conversation.vue` transportent les deux textes
  (affiché / transmis) via `stores/intent.ts`.
- **Mapping intent → agent strictement backend** (`agent_router.py`) :

| intent | agent | pourquoi |
|---|---|---|
| `clients` | `sales-outbound-strategist` | prospection et génération de leads |
| `mlm` | `sales-closer-mlm` | parrainage / réseau |
| `ventes` | `sales_expert` | vente consultative et closing |
| `site_web` | `design-landing-page-specialist` | pages qui convertissent |
| `seo` | `marketing-seo-specialist` | référencement |
| `ads` | `marketing-meta-ads-specialist` | campagnes publicitaires |
| `social` | `marketing-social-media-manager` | réseaux sociaux |
| `ia_auto` | `marketing-growth-hacker` | automatisation, croissance |
| `funnel` | `marketing-funnel-architect` | tunnels de conversion |

- **Tracking** : chaque clic est tracé (`suggestion_id`, `intent`, `label`,
  horodatage ISO, `session_id`) et transmis dans
  `visitor_info.suggestion_click` ; le backend l'enregistre en événement
  `suggestion_click` dans `chatbot_analytics` **avec l'agent réellement
  utilisé** — la donnée relie le clic, la conversation et la réponse.
- **Objectif stratégique** : `_get_intent_instructions` porte une entrée
  « compétence à démontrer » par intent, et `_generate_suggestions` propose des
  **suites de la compétence** (ex. après `seo` : « Quels mots-clés viser
  d'abord ? », « Être cité par les IA (ChatGPT, Google) ») au lieu du repli
  « En savoir plus / Parler à un conseiller ».

### Deux défauts de routage trouvés au passage (et corrigés)

1. **`INTENT_TO_AGENT_MAP` pointait vers des agents inexistants**
   (`marketing-content-creator`, `sales-deal-strategist`, `design-brand-guardian`…).
   `_get_agent_path` rendait `None` → **le persona n'était pas chargé** → le LLM
   répondait sans expertise, sur un prompt de repli générique. Les 40+ entrées
   ont été réalignées sur les 27 fichiers réels, et un **test** vérifie
   désormais que **tout** mapping pointe vers un fichier existant.
2. **L'override MLM ne se déclenchait jamais** : il lisait
   `context['message_history']`, une clé que `ContextBuilder` ne remplit pas
   (il remplit `history`). Corrigé — et neutralisé pour les intents de
   suggestion (un clic « Améliorer mon référencement » ne doit pas être détourné
   vers l'outbound).

### Preuve en production (clic « Améliorer mon référencement »)

Bulle visiteur : « Améliorer mon référencement » / « Vous · à l'instant » (aucun
`[intent:…]` visible). Réponse de Mia : deux chantiers distingués (technique
1-2 semaines, contenu 3-6 mois), exemple de requête visée, mention de la citation
par les IA, plan 90 jours, **et une demande d'information utile** (site, ville).
La compétence SEO est démontrée, pas annoncée. Sortie complète :
`e2e-live-resultats.json` → `A8_reponse_seo`, capture `live-A8-suggestion-seo.png`.

---

## A.9 — Onglet Aide enrichi

Section « **Ce que Mia peut faire pour vous** » en tête de l'onglet Aide : les
**9 capacités**, mêmes libellés et mêmes clés que l'accueil (source unique
`capacites.ts`), chacune cliquable → ouverture de la conversation avec l'intent
chargé et clic tracé. **Aucun nom d'agent.** La section reste visible pendant une
recherche (c'est l'entrée la plus utile quand le visiteur ne sait pas quoi
chercher). Capture : `A9-aide-{avant,apres}-*.png`.

---

## A.10 — `ONBOARDING-MIA.md`

Livré à la racine du dépôt widget. Six sections : le flux d'ouverture (message
A.4 + les 9 suggestions, avec les trois verrous et le cas de la session
expirée), le comportement attendu sur les **5 premiers messages** (tableau),
ce qui est **INTERDIT** (tableau de 7 interdits + les 4 garde-fous en place),
ce qui est **ATTENDU** (réponse naturelle, signature, démonstration des
compétences, honnêteté), le cas de l'image jointe, la section **N3** (les deux
événements : déclencheur, forme, absence de données personnelles), et un tableau
« où intervenir » (quel fichier pour quel changement).

---

## A.11 — Non-régression

| Contrôle | Attendu | Mesuré |
|---|---|---|
| Garde-fou site | 16/16 | ✅ `16/16 page(s) avec SDK + générateur conforme + coordination en place` |
| Garde-fou blog | 88/88 | ✅ `88/88 page(s) avec SDK + générateur conforme` |
| Tests widget | 90/90 (avant) | ✅ **128/128** (90 + 38 nouveaux) |
| Tests backend | — | ✅ **95/95** (nouveaux, `test_tache_6_3_bis.py`) |
| Typecheck widget | 0 erreur | ✅ `vue-tsc -b` propre |
| `/health` backend | 200 | ✅ `{"status":"healthy","database":"ok"}` |
| Site / blog / widget (HTTP) | 200 | ✅ 200 / 200 / 200 |
| Consent Mode v2 | intact | ✅ `consent default` toujours `denied` sur `ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage` (`wait_for_update: 500`) |
| Bulle sous bandeau de consentement | masquée | ✅ `bulle visible avec bandeau = false`, `sans bandeau = true` (D9, inchangé) |
| Chevauchement `.sticky-cta` | 0 px² | ✅ **0 px²** (bouton WhatsApp) et **0 px²** (barre) en 1280×720 **et** 390×844 |
| Bundle widget | < 150 Ko gzip | ✅ 30,3 + 37,7 Ko (JS) + 3,3 + 2,3 Ko (CSS) ≈ **73,6 Ko gzip** · SDK 5,1 Ko gzip |
| Empreinte réseau / dépendances | aucune ajoutée | ✅ **aucun paquet npm ajouté** (Pillow était déjà dans `requirements.txt` backend) |

Mesures : `mesures-non-regression.json` (production, SDK déployé chargé par
`https://eperformance.pro`). Le script est rejouable :
`python3 docs/phase3-tache-6-3-bis/non-regression.py`.

**Contraintes de design tenues :** aucun emoji d'interface (les 👋 du message
d'ouverture et le sélecteur d'emojis restent, comme prévu), aucun hex en dur
dans le code neuf du widget (jetons canoniques uniquement), polices
auto-hébergées, zéro Google Fonts, focus visible et ARIA conservés
(`aria-labelledby` sur les familles de capacités, `role="log"` sur le fil).

---

## N3 — Événements de mesure pour le noyau et le site (ajout du coordinateur)

Demandé par l'agent NOYAU (`agent-ia-web`, commit `17cbb21`) : deux des quatre
événements GA4 de son document `docs/chatbot-integration-noyau.md` attendaient
que **notre** SDK les émette.

| Événement (document de la page hôte) | Déclencheur | `detail` |
|---|---|---|
| `eperf:chatbot:message` | chaque réponse de Mia affichée (intent du backend, `non_detecte` si vide) | `{ intent: 'seo' }` |
| `eperf:chatbot:lead` | clic sur le lien WhatsApp du fallback, ou capture détectée par le pipeline (`lead_capture`, `schedule_callback`) | `{ type: 'whatsapp_clic' }` |

Chaîne : le widget **postMessage** au SDK (`{event:'message'|'lead'}`) → le SDK
**rediffuse un `CustomEvent` sur le document de la page** (seul endroit du SDK
qui s'exécute dans la page hôte).

**Vie privée (contrainte absolue respectée) :** les `detail` ne contiennent
qu'une **catégorie** (`intent` : `[a-z0-9_-]{1,40}`, sinon `non_detecte`) ou une
**valeur d'énumération fermée** (`whatsapp_clic`, `formulaire`, `email_clic`).
Le SDK **rejette** toute valeur non conforme : une page hôte ne peut pas faire
transiter de texte libre par ce canal. Aucun nom, e-mail, téléphone ni contenu de
message. Un test envoie un message contenant un numéro, un e-mail et un prénom
et vérifie qu'**aucun** n'apparaît dans les `detail`.

**Non-régression de l'API publique :** `ePerformance.on('open'|'close')` est
inchangée (elle n'est pas touchée) — le site et le blog l'utilisent en
production. N3 **ajoute**, ne remplace pas. Le SDK déployé contient bien
`eperf:chatbot:lead` (vérifié sur le fichier servi par GitHub Pages).

⚠️ **DEMANDE (journal)** : le SDK émet désormais des événements sur le document
de la page hôte. C'est une **addition** attendue par le site et le noyau, sans
modification d'interface existante — mais le périmètre touche un contrat partagé,
donc c'est consigné comme tel.

---

## Écarts documentés

1. **Émulateurs Android/iOS non installés** sur cette machine (SDK Android
   absent ; iOS exige macOS/Xcode). La validation navigateur se fait par
   **émulation de viewport** dans un vrai moteur de rendu (Chromium via
   Playwright) aux viewports demandés — 1280×720 et 390×844 — en clair et en
   sombre. **Ne sont pas couverts** : clavier iOS réel, safe-area physiques,
   Web Speech API mobile, comportements de scroll natifs iOS/Android. C'est la
   limitation annoncée, identique à celle documentée en 6.2-bis.
2. **Vision en deux appels** au lieu d'un seul message multimodal (A.1) :
   imposé par la mesure (la lecture de l'image se perd dans le prompt long).
   Le chemin multimodal direct reste implémenté en repli.
3. **`detail` forcé à `high` sur l'appel de description** (plus fiable sur les
   petites images mesurées) ; la valeur du client (`auto` par défaut) est validée
   et transmise sur le chemin de repli.
4. **Réponse en `text` seul** (`html` toujours `null`) : le bloc HTML à boutons
   `onclick` que le widget ne consommait pas, et à couleurs en dur justes en
   thème sombre, est supprimé. Contrat mis à jour (§3).
5. **Séparateurs de signature différents** pour le visiteur (`·`, spécifié en
   A.3) et pour Mia (`•`, spécifié en A.4) — les deux spécifications sont
   appliquées littéralement plutôt qu'harmonisées.
6. **Article vedette déplacé après les capacités** sur l'accueil (A.8) —
   justification en A.8.
7. **Suggestion à intent inconnu** : le préfixe est retiré et l'intent passe au
   détecteur par mots-clés (repli), jamais une erreur. Les 9 clés livrées sont
   couvertes par un test de cohérence backend.
8. **L'image n'est pas persistée** : elle n'existe que pour le tour courant
   (aucun stockage en base, aucun historique d'images). Décision documentée dans
   `vision.py`.
9. **N3 (ajout de périmètre demandé en cours de mission)** — voir section
   dédiée.

---

## Où regarder

| Élément | Fichier |
|---|---|
| Captures avant/après + harnais | `docs/phase3-tache-6-3-bis/` (`captures.py`) |
| Mesures de défilement | `docs/phase3-tache-6-3-bis/mesures-defilement.json` |
| Mesures de non-régression production | `docs/phase3-tache-6-3-bis/mesures-non-regression.json` |
| Validation live (A.1, A.4, A.5, A.6, A.8) | `docs/phase3-tache-6-3-bis/e2e-live-resultats.json` |
| Doc de comportement | `ONBOARDING-MIA.md` |
| Contrat d'interface | `/home/ballo/OX6A/CONTRAT-INTERFACE-V2.md` (V2.2) |
| Tests widget | `src/components/blocA.spec.ts`, `src/api/railway.spec.ts`, `src/sdk/sdk.spec.ts` |
| Tests backend | `backend/chatbot/test_tache_6_3_bis.py` |
