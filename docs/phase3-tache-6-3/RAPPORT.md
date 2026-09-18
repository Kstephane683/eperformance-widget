# Tâche 6.3 — Dashboard admin : barre latérale, en-tête, modules résiduels

**Date :** 18 septembre 2026 · **Périmètre :** dépôt `eperformance-widget` uniquement.
**Hors périmètre, non touché :** `unified-ia-backend/**`, `docker-unified/**`,
`site-eperformance/**`, `blog-eperformance/**`, `eperformance-widget/src/sdk/**`
(gelé par contrat), `application/**` (pages publiques sans Vue), le mécanisme de
déploiement GitHub Pages.

| Livrable | État | Preuve |
|---|---|---|
| 1. Barre latérale — 11 modules groupés par intention | ✅ | `src/admin/components/Sidebar.vue`, `src/admin/navigation.ts` |
| 2. En-tête — recherche, notifications, profil | ✅ | `src/admin/components/Header.vue` + `GlobalSearch.vue`, `NotificationsMenu.vue`, `ProfileMenu.vue` |
| 3. Modules résiduels migrés aux jetons canoniques | ✅ | `src/admin/admin.css`, `src/admin/views/**` — **0** couleur littérale |
| 4. Zéro valeur hexadécimale en dur (compté) | ✅ | `docs/phase3-tache-6-3/mesures-couleurs.json` : **47 → 0** |
| 5. Tests — 11 modules accessibles, navigation, suite existante intacte | ✅ | **219/219** (171 avant), 15 fichiers |
| 6. Captures avant/après, clair et sombre, mobile et desktop | ✅ | **78 captures** dans `docs/phase3-tache-6-3/` |
| 7. Ce rapport | ✅ | `docs/phase3-tache-6-3/RAPPORT.md` |

---

## 1. Les 11 modules et leur regroupement

Le regroupement se fait par **intention** — ce qu'on veut faire — et non par
type d'objet. C'est la structure d'Intercom, et c'est ce qui manquait : la
console d'origine était une liste plate de 4 entrées.

| Groupe | Module (libellé) | Route | Source de données (toutes réelles) |
|---|---|---|---|
| **Pilotage** | Tableau de bord | `#/tableau-de-bord` | `GET /admin/stats` + liste des conversations |
| | Activité | `#/activite` | journal déduit des conversations (création, dernier message, coordonnées, prise en main) |
| | Performance | `#/performance` | rapports de compteurs sur les 50 dernières conversations |
| **Conversations** | Boîte de réception | `#/conversations` | `GET /admin/conversations` (+ `/{id}`, takeover, release, human-message) |
| | Prospects | `#/prospects` | conversations portant un nom ou un téléphone |
| | Candidatures | `#/candidatures` | `GET /admin/candidats` |
| **Contenu** | Base de connaissances | `#/connaissances` | `chatbot-index.json` embarqué (collections, source, date) |
| | Publications | `#/publications` | articles publiés du même index |
| | Compétences de Mia | `#/competences` | `src/data/capacites.ts` — 9 capacités, 3 familles |
| **Réglages** | Utilisateurs | `#/utilisateurs` | `GET /admin/users` |
| | Intégrations | `#/integrations` | modules PHP du CRM historique (LWS) |

**Aucun module n'invente de données.** Trois écrans (Tableau de bord, Activité,
Performance) sont calculés à partir de données déjà chargées, et chacun écrit sa
**fenêtre d'observation** à l'écran (« sur les 50 conversations les plus
récentes ») : un taux affiché sans sa fenêtre est un taux qui trompe.

**Aucun module n'expose d'agent.** Les 27 agents internes ne sont ni nommés, ni
comptés, nulle part — voir §4.

## 2. Barre latérale

| Point | Décision | Pourquoi |
|---|---|---|
| Structure | 4 groupes titrés (Pilotage, Conversations, Contenu, Réglages), 264 px | On ne cherche pas un écran, on cherche ce qu'on veut faire |
| État actif | fond d'accent + barre d'accent de 3 px + graisse 600, `aria-current="page"` | Trois signaux : l'état reste lisible sans percevoir la teinte (WCAG 1.4.1) |
| Pastilles | conversations et candidatures en attente, alimentées par `/admin/stats` | Ce qui demande une action se voit sans ouvrir le module |
| Clavier | `Tab` naturel + flèches ↑↓, `Début`/`Fin` ; cibles de 44 px | Une console se pilote au clavier |
| Mobile (≤ 1000 px) | tiroir hors-champ, voile, fermeture à `Échap` / clic sur le voile / choix d'un module, **retour du focus au bouton** | La structure groupée survit au mobile, ce qu'une rangée d'onglets ne permettait pas |
| Pied | carte « Mia » — seul nom affiché de tout l'écran | Ancre la règle produit : seul Mia est visible |

## 3. En-tête

L'en-tête ne **concurrence pas** la barre latérale : 64 px, verre (`--voile`),
filet unique, aucun aplat de marque, et la marque reste dans la barre latérale.

| Élément | Comportement | Accessibilité |
|---|---|---|
| Titre du module | lu dans le registre, jamais écrit dans la vue | un seul `<h1>` par écran |
| Recherche | cherche dans les conversations chargées, puis dans candidatures, comptes, publications et compétences ; « cafe » trouve « café » | motif ARIA combobox complet : `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, options `role="option"` |
| Notifications | entrées réelles : conversations en attente, candidatures à traiter, prospects capturés ; chacune mène au module avec son filtre | bouton `aria-expanded` + `aria-controls`, panneau `role="dialog"` focalisé à l'ouverture, `Échap` referme et rend le focus |
| Profil | identité lue dans la charge utile du JWT, thème clair/sombre/système, déconnexion | `aria-expanded`, panneau `role="dialog"`, radios étiquetées, `Échap` |
| Fermeture des panneaux | clic extérieur + `Échap` + retour du focus, écrit **une fois** (`src/admin/popover.ts`) | trois panneaux, un seul contrat |

## 4. Sécurité produit : les agents internes n'apparaissent plus

L'écran « Chatbot » d'origine exposait le routage interne à **trois endroits** :
`IA — sales-coach` sous chaque message de Mia, une pastille `Agent : <clé>` dans
l'en-tête du détail, et un sélecteur « Assigner à un agent… » alimenté par
`GET /agents` (clés **et** libellés internes).

| | Avant | Après |
|---|---|---|
| Auteur affiché sous un message | `IA — sales-coach` | `Mia` |
| En-tête du détail | pastille `Agent : sales-coach` | badge de statut + site + nombre de messages |
| Assignation | sélecteur listant les agents | supprimée — le routage reste au backend |
| Client d'API | `GET /agents`, `POST /assign` | retirés (`src/admin/api.ts`, note explicative) |

**Mesuré, pas déclaré** : les jeux d'essai des captures contiennent
`sales-coach`, `closer-pro`, `seo-expert` et leurs libellés. Le texte rendu est
analysé à chaque capture (`docs/phase3-tache-6-3/mesures-interface.json`) :

| | Avant | Après |
|---|---|---|
| Captures contenant un terme interne | **4** (`avant-chatbot-conversation-*`) | **0** sur 54 |
| Captures contenant un emoji | **10** (le bouton `↻ Actualiser`) | **0** sur 54 |

Deux tests unitaires verrouillent la règle côté code : avec un jeu d'essai qui
porte `sales-coach`, le texte rendu ne doit contenir ni la clé, ni le mot
« assigner » (`src/admin/console.spec.ts`).

## 5. Migration des modules résiduels aux jetons

### 5.1 Couleurs littérales — comptées

`python3 docs/phase3-tache-6-3/mesures.py couleurs` (périmètre interface :
`admin.html` + `src/admin/**` hors fichiers de test) :

| Périmètre | Avant | Après |
|---|---|---|
| `admin.html` + `src/admin/**` (sources) | **4 hex + 43 rgb/rgba = 47** | **0 + 0 = 0** |
| Build compilé (`assets/admin-*`) | 49 hex | **1 hex** — `#0000`, la forme minifiée de `transparent` produite par le minifieur, aucune couleur de source |
| Fichiers de test | — | 2 hex + 4 rgb (valeur simulée de `getComputedStyle`, motif de détection) — jamais affichés |

Détail de l'avant : `DashboardView.vue` (1 hex + 25 rgb), `CandidatsView.vue`
(2 hex + 9 rgb), `LoginView.vue` (4 rgb), `UsersView.vue` (3 rgb), `App.vue` (2 rgb).

Le contrôle est aussi un **test** (`src/admin/regles.spec.ts`) : les sources de
la console sont lues par Vite et comparées à `#[0-9a-fA-F]{3,8}` / `rgba?\(`.
Une couleur littérale réintroduite fait échouer la suite.

### 5.2 Jetons ajoutés (additif, valeurs du noyau)

`src/styles/jetons.css` gagne les jetons d'état et les voiles. **Aucune valeur
existante n'est modifiée** : le widget et les pages publiques consomment les
mêmes jetons qu'avant.

| Jeton | Valeur claire | Valeur sombre | Source canonique |
|---|---|---|---|
| `--succes`, `--succes-filet`, `--succes-trace` | `#12703f` + 28 % / 6 % | `#6fcf8a` + 30 % / 10 % | noyau `10-primitives.css:99-100`, `20-semantic.css:92-93,313-314` |
| `--alerte`, `--alerte-filet`, `--alerte-trace` | `#8a5a10` + 30 % / 7 % | `#e0b45f` + 32 % / 10 % | idem `:101-102, 95-97, 315-316` |
| `--info`, `--info-filet`, `--info-trace` | `#1f5a8a` + 28 % / 6 % | `#7db4de` + 30 % / 10 % | idem `:105-106, 103-105, 319-320` |
| `--neutre-trace`, `--neutre-filet` | `color-mix(--muted 12 % / 26 %)` | `16 % / 30 %` | dérivés de `--muted`, comme `--gold-bg` |
| `--voile`, `--voile-fort` | `color-mix(--card 82 %)`, `color-mix(--bg 78 %)` | idem | dérivés, aucune couleur propre |

Ces jetons remplacent : `#fbbf24` et `rgba(251,191,36,…)` (badge d'escalade),
`#e28d3e` (statut candidature), `#60a5fa` (alumni), `rgba(52,199,123,…)`,
`rgba(154,150,140,…)`, `rgba(122,118,108,…)`, `rgba(220,38,38,…)`,
`rgba(201,169,110,…)` (×12 — remplacés par `--gold-bg` / `--gold-border`),
`rgba(12,12,16,…)`, `rgba(10,10,14,…)`, `rgba(0,0,0,0.45)` (ombres → `--shadow-md`).

`mesures-jetons.json` : **39 jetons consommés**, 54 déclarés, **0 jeton inconnu**,
**0 primitive `--p-*`** consommée directement (interdit par le noyau,
`10-primitives.css:14-16`). Un test fige la liste des jetons consommés : une
faute de frappe sur un nom de jeton (`--gold-2`) ne casse rien à l'exécution —
elle rend la couleur absente, donc invisible en revue ; le test la transforme en
échec.

## 6. Accessibilité — mesuré

### 6.1 Contraste (WCAG 2.1 AA) — 50 paires calculées, 50 conformes

`python3 docs/phase3-tache-6-3/mesures.py contraste` lit les valeurs **réelles**
de `jetons.css` et compose les fonds translucides (une trace d'état n'a de
couleur qu'une fois posée sur son fond).

| Paire | Seuil | Clair | Sombre |
|---|---|---|---|
| Texte sur fond de page | 4,5 | 17,71 | 16,64 |
| Texte discret sur fond de page | 4,5 | 5,41 | 5,93 |
| Texte discret sur barre latérale | 4,5 | 5,10 | 5,79 |
| Élément actif sur sa trace | 4,5 | 5,62 | 10,45 |
| État alerte sur sa trace | 4,5 | 5,24 | 9,01 |
| État information sur sa trace | 4,5 | 6,48 | 7,93 |
| État réussite sur sa trace | 4,5 | 5,51 | 9,10 |
| Texte sur accent plein | 4,5 | 5,05 | 8,83 |
| Filet de contrôle sur surface (1.4.11) | 3,0 | 3,44 | 3,25 |

Les champs utilisent `--border-strong` (et non `--border`) : un champ est un
« Contrôle » au sens de WCAG 1.4.11 et doit atteindre 3:1.

### 6.2 Clavier, focus, structure — testé

| Exigence | Mise en œuvre | Test |
|---|---|---|
| Navigation clavier dans la barre latérale | flèches ↑↓, `Début`/`Fin`, ordre du document conservé | `console.spec.ts` — « parcourt les modules au clavier, dans l'ordre affiché » |
| `aria-current` sur l'élément actif | sur le seul module actif | « ne pose `aria-current` que sur le module actif » |
| Focus visible | anneau or 2 px (`style.css`) ; champs : filet or + halo 3 px | — |
| Réduction d'animation | `prefers-reduced-motion` (hérité du socle) | — |
| Panneaux (recherche, notifications, profil) | clic extérieur, `Échap`, retour du focus | « s'ouvre au bouton, se ferme à `Échap` et rend le focus au bouton » |
| Lien d'évitement | « Aller au contenu » → `#adm-contenu` focalisé | « mène au contenu par le lien d'évitement » |
| Cibles tactiles | 44 px (barre latérale), 40 px (contrôles) | — |
| Structure de titres | un `<h1>` par écran (titre du module dans l'en-tête) | « rend chaque module, avec son titre dans l'en-tête » |
| Tableaux | `<caption>` en texte réservé aux lecteurs d'écran, `<th scope="col">` | — |
| Lanceur de recherche | `role="combobox"` + `aria-activedescendant` | « annonce l'état du champ de recherche » |

## 7. Non-régression

| Contrôle | Avant | Après |
|---|---|---|
| `npm test` (vitest) | **171/171** (11 fichiers) | **219/219** (15 fichiers) |
| `npm run build` (`vue-tsc -b` + widget + SDK) | ✅ | ✅ |
| SDK (`dist/eperformance-sdk.js`) | 13,97 Ko (5,07 Ko gzip) | **13,97 Ko (5,07 Ko gzip)** — `src/sdk/**` non modifié |
| Entrée widget (JS + CSS + thème + commun) | 232,0 Ko (80,2 Ko gzip) | 234,9 Ko (81,2 Ko gzip) |
| Entrée admin | 49,6 Ko (13,2 Ko gzip) | 115,1 Ko (27,7 Ko gzip) |
| Dépendances | — | **aucune ajoutée** (`package.json` inchangé) |
| Pages publiques `application/**` | — | non touchées ; vérifiées au rendu : `/application/` (3 titres, `--gold` = `#856b37`) et `/application/mia/` s'affichent sans erreur |
| Widget (5 vues, mode iframe) | — | `src/views/**`, `src/components/**` non touchés ; vérifié au rendu en mode application (`?app=1`) : écran rendu, `--bg2` = `rgb(247,245,241)`, aucune erreur console |

Les 48 tests ajoutés couvrent : les 11 modules et leurs routes, les redirections
des anciens chemins, la navigation clavier, le tiroir mobile, la recherche, les
notifications, le thème, la déconnexion, les règles de sources (couleurs, emoji,
jetons).

## 8. Captures

**78 captures** dans `docs/phase3-tache-6-3/`, produites par
`python3 docs/phase3-tache-6-3/captures.py` (Playwright, API simulée — les
captures ne dépendent ni du réseau ni d'un compte réel, et sont reproductibles).

| Série | Écrans | Gabarits | Thèmes | Total |
|---|---|---|---|---|
| `apres-*` | 13 (11 modules + connexion + conversation ouverte) + tiroir mobile | 390×844, 1440×900 | clair, sombre | **54** |
| `avant-*` | 6 (connexion, chatbot, conversation ouverte, utilisateurs, candidats, CRM) | 390×844, 1440×900 | clair, sombre | **24** |

Exemples de chemins directs :

- `docs/phase3-tache-6-3/apres-tableau-de-bord-desktop-1440x900-clair.png`
- `docs/phase3-tache-6-3/apres-conversations-mobile-390x844-sombre.png`
- `docs/phase3-tache-6-3/apres-menu-mobile-mobile-390x844-sombre.png`
- `docs/phase3-tache-6-3/avant-chatbot-conversation-desktop-1440x900-sombre.png`
- `docs/phase3-tache-6-3/mesures-interface.json` (analysis of each capture)

Deux résultats mesurés sur les images :

- **le thème clair n'existait pas avant** : les 12 captures claires de l'avant
  ont exactement la même empreinte MD5 que leurs jumelles sombres (la console
  était en `data-theme="dark"` en dur) — c'est écrit dans le JSON ;
- **4 → 11 entrées de barre latérale** : 0 module atteignable au nouveau
  sélecteur dans l'avant, 11 dans l'après (et 4 au sélecteur de l'ancienne
  structure).

Le dossier `docs/phase3-tache-6-3/avant/` conserve les **sources d'origine**
(`src-admin/` et `admin.html` tels qu'ils étaient) et `dist-avant/` le build du
commit précédent : la mesure « avant » reste vérifiable après la réécriture —
un compte avant/après n'a de valeur que si l'avant est encore là.

## 9. Défauts trouvés et corrigés

| Défaut | Emplacement | Preuve |
|---|---|---|
| **Écran de connexion vide** : `<LoginView>` utilisée sans être importée → Vue rendait un élément inconnu `<loginview>`. Invisible en production parce que le shell LWS injecte le jeton par `postMessage` avant le montage | `src/admin/App.vue` (avant) | `avant-connexion-*-*.png` : page noire, sans formulaire |
| **Fuite des agents internes** (3 endroits) | `ConversationsView` (ex-`DashboardView.vue`) | §4 |
| Redirection de connexion vers un nom de route inexistant (`{ name: 'dashboard' }`) | `src/admin/views/LoginView.vue` | corrigé vers le registre (`MODULE_PAR_DEFAUT`) |
| Bouton « Actualiser » porteur d'un caractère `↻` | `UsersView`, `CandidatsView` | 10 captures de l'avant portent l'emoji, 0 après |
| `main.ts.bak` versionné | `src/admin/` | supprimé |

## 10. Ce qui reste

1. **Le favicon de la console est encore le logo Vite violet** (`public/favicon.svg`),
   alors que l'application Mia a ses icônes (`public/icons/`). Hors du périmètre
   de la tâche 6.3 (identité visuelle, pas jetons) — à traiter avec les assets de
   marque.
2. **Les notifications sont dérivées côté client** des 50 dernières conversations
   chargées : il n'existe pas de flux de notifications côté backend. Au-delà de
   50 conversations, une demande ancienne peut ne pas apparaître.
3. **Le module Performance mesure la fenêtre chargée**, pas l'historique complet :
   il faudrait un endpoint d'agrégats (`/admin/stats` par période) pour des taux
   sur 30 jours. C'est dit à l'écran, ce n'est pas caché.
4. **Aucun audit automatisé (axe / Lighthouse) sur la console** : la conformité
   est établie par le calcul des ratios (50 paires) et par les tests de
   navigation — c'est le niveau demandé par la tâche, un audit outillé serait un
   plus.
5. **Les commandes d'écriture** (`takeover`, `release`, `human-message`) n'ont pas
   été exercées en conditions réelles dans cette tâche : les captures simulent
   l'API.
6. **Commits locaux, non poussés** : les 6 commits ci-dessous sont sur `main` en
   local. Le déploiement GitHub Pages n'a pas été déclenché (le propriétaire
   décide du moment).

### Hors périmètre, inchangé (et pourquoi)

| Élément | Raison |
|---|---|
| `src/sdk/entry.ts` (contient 6 hex) | **gelé par contrat** — les valeurs y sont les replis des jetons pour un site hôte |
| `src/stores/config.ts` (3 hex) | couleur d'accent par défaut du widget, **documentée** (`--gold` clair/sombre) ; hors du périmètre dashboard |
| `src/style.css` (jetons du socle) | c'est la source des jetons, avec `src/styles/jetons.css` |
| `index.html` (2 hex) | couleur de barre du widget publié (`theme-color`), hors dashboard |

## 11. Reproduction

```bash
cd eperformance-widget
npm test                                     # 219 tests
npm run build                                # vue-tsc + widget + SDK
python3 docs/phase3-tache-6-3/mesures.py     # couleurs, contraste, jetons
python3 docs/phase3-tache-6-3/captures.py    # 78 captures + mesures d'interface
```

## 12. Commits (un sujet par commit)

| Commit | Sujet |
|---|---|
| `b260191` | `feat(jetons): jetons d'état et voiles de barre issus du noyau` |
| `ad95bc1` | `feat(admin): socle de la console — modules, thème, identité, recherche, store` |
| `02d4cce` | `feat(admin): barre latérale groupée, en-tête et shell de la console` |
| `e1b2480` | `feat(admin): 11 modules — 8 écrans nouveaux, 3 écrans migrés aux jetons` |
| `cd3d465` | `fix(admin): les clés d'agent interne ne sont plus affichées` |
| `c4163eb` | `test(admin): 48 tests — 11 modules, navigation, en-tête, thème, règles` |
| `docs(6.3)` | captures avant/après, harnais de preuve, mesures et ce rapport |
