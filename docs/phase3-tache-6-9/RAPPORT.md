# Tâche 6.9 — Vérification de cohérence design, par la mesure

**Date :** 18 septembre 2026 · **Périmètre d'écriture :** `eperformance-widget`
uniquement. **Lu sans être modifié :** `agent-ia-web/eperf_core/assets/css/`
(source canonique), `site-eperformance/`, `blog-eperformance/`.
**Jamais touché :** `unified-ia-backend/**`, `docker-unified/**`,
`eperformance-widget/src/sdk/**` (gelé par contrat).

| Point de la tâche | Mesure | Résultat |
|---|---|---|
| 1. Jetons identiques partout | **7 périmètres**, valeurs canonisées, empreinte SHA-256 par thème | Console, application Mia et pages publiques : **empreinte identique** au widget. 8 divergences avec le site, 9 avec le noyau, toutes nommées et chiffrées |
| 2. Polices auto-hébergées, zéro Google Fonts | 6 périmètres, empreinte de chaque déclaration et de chaque fichier | **Mêmes familles, mêmes fichiers** (empreinte de fichier `cc9762f9…` identique pour le widget, le site et le blog). **3 références distantes trouvées** dans le site |
| 3. Arrondis, couleurs, espacements | Échelles comparées, couleurs littérales comptées | Arrondis et durées : **mêmes valeurs** sauf un cran. **6 hex littéraux** dans l'interface, tous des `theme-color`, tous égaux au jeton `--bg` |
| 4. Zéro emoji dans l'interface | Compte avant/après, trois natures distinguées | **4 puis 1** dans les chaînes d'interface ; **3 corrigées** ; la dernière est dans le SDK gelé |
| 5. Rapport avec captures côte à côte | 5 rôles × 3 contextes, **84 valeurs calculées** comparées | **13 divergences de design system**, 27 différences de métier. Verdict par écran en §7 |

**Tout est mesuré, rien n'est déclaré.** Chaque chiffre de ce rapport vient d'un
des cinq fichiers `mesures-*.json` du dossier, produits par
`python3 docs/phase3-tache-6-9/mesures.py` et
`python3 docs/phase3-tache-6-9/composants.py`.

---

## 1. Jetons : ce qui a été comparé, et comment

### 1.1 La méthode, et pourquoi elle est en deux parties

Les périmètres ne nomment pas leurs jetons de la même façon : le noyau écrit
`--fond`, `--accent`, `--rayon-champ` ; le site, le blog, le widget, la console
et les pages publiques écrivent `--bg`, `--gold`, `--arrondi-input`. Comparer
ces noms directement ne mesurerait rien.

Deux comparaisons sont donc menées, et elles ne répondent pas à la même
question :

| Comparaison | Question | Périmètres |
|---|---|---|
| **A — par nom** | Ces périmètres-là sont-ils d'accord entre eux ? | site, blog, widget, console, application Mia, pages publiques (même espace de noms) |
| **B — noyau et site** | Les valeurs du produit sont-elles bien celles de la source canonique ? | noyau (couches 1 et 2) contre le widget, via la correspondance **écrite en tête de `src/styles/jetons.css`** |

La correspondance de la comparaison B n'est pas inventée ici : elle est recopiée
du commentaire du propriétaire du dépôt (lignes 12 à 18 de `jetons.css`). C'est
une **hypothèse** ; la comparaison de valeurs en est la **preuve**. Une
correspondance fausse ne passe pas inaperçue, elle produit une divergence
nommée.

### 1.2 Canonisation : comparer des valeurs, pas des écritures

`rgba(201, 169, 110, 0.08)` et `color-mix(in srgb, #c9a96e 8%, transparent)`
sont la même couleur écrite de deux façons. Chaque valeur est donc résolue
(`var()` remplacés, `color-mix` converti) puis ramenée à une forme canonique
avant comparaison.

Cette étape n'est pas cosmétique : **sans elle, trois faux positifs
apparaissaient** — les trois voiles d'accent en thème sombre, numériquement
identiques entre le site et le widget, comptaient comme trois divergences.

### 1.3 Empreintes par périmètre

Empreinte SHA-256 du jeu de jetons trié, thème par thème :

| Périmètre | Déclarés clair / sombre | Consommés | Empreinte clair | Empreinte sombre |
|---|---|---|---|---|
| **noyau** (couches 1+2) | 208 / 36 | 139 | `b1eef078da7af682…` | `0733e3181bc7f34d…` |
| **site** (`assets/css/eperf.css`) | 59 / 35 | 39 | `cebe50ea04b079218…` | `91f5c84e46c939239…` |
| **blog** (`assets/css/eperf.css`) | 59 / 35 | 39 | `cebe50ea04b079218…` | `91f5c84e46c939239…` |
| **widget** | 54 / 42 | 30 | `e1fc55546b5ce00a0…` | `f55dbedf64ae15901…` |
| **console** | 54 / 42 | 43 | `e1fc55546b5ce00a0…` | `f55dbedf64ae15901…` |
| **application Mia** | 54 / 42 | 30 | `e1fc55546b5ce00a0…` | `f55dbedf64ae15901…` |
| **pages publiques** | 54 / 42 | 27 | `e1fc55546b5ce00a0…` | `f55dbedf64ae15901…` |

**Le résultat central** : le widget, la console, l'application Mia et les pages
publiques ont des empreintes **strictement identiques**. Ce n'est pas une
coïncidence, c'est une construction : `src/styles/jetons.css` est la seule
feuille du dépôt qui déclare des jetons ; `src/style.css`, `src/admin/admin.css`
et `src/application.css` n'en déclarent **aucun** et les consomment. Les quatre
contextes du produit partagent donc littéralement la même source.

Le site et le blog sont identiques entre eux (même empreinte, même fichier :
`eperf.css` a le même MD5 `3fa9c37e…` dans les trois copies du site, blog et
aperçu). Ils diffèrent du widget — c'est l'objet de §1.5.

### 1.4 Jetons consommés mais non déclarés

| Périmètre | Consommés | Hors des jetons déclarés |
|---|---|---|
| widget / application Mia | 30 | 1 : `--ep-` (repli du SDK, voir §1.6) |
| console | 43 | 1 : `--ep-` (idem) |
| pages publiques | 27 | **0** |

Aucun jeton fantôme : chaque `var(--…)` du widget, de la console et des pages
publiques correspond à un jeton réellement déclaré, sauf le repli du SDK qui est
volontaire.

### 1.5 Les divergences trouvées — 8 avec le site, 9 avec le noyau

**Comparaison A — 72 jetons comparés, 8 divergences** (site/blog contre
widget/console/application/pages) :

| Jeton | Thème | Site et blog | Widget, console, application, pages | Verdict |
|---|---|---|---|---|
| `--gold` | clair | `#8a6f38` | `#856b37` | **Justifiée, et vérifiée par calcul** |
| `--gold-bg` | clair | `rgba(138,111,56,.07)` | `rgba(133,107,55,.07)` | Conséquence de la précédente |
| `--gold-border` | clair | `rgba(138,111,56,.22)` | `rgba(133,107,55,.22)` | Conséquence de la précédente |
| `--gold-glow` | clair | `rgba(138,111,56,.28)` | `rgba(133,107,55,.28)` | Conséquence de la précédente |
| `--gold2` | clair | `#8f7238` | `#735d32` | **Non corrigée — voir recommandation** |
| `--arrondi-input` | clair | `10px` | `12px` | **Non corrigée — voir recommandation** |
| `--police-corps` | clair | ajoute `'DM Sans Fallback'` | `'DM Sans', system-ui, …` | Sans effet : la première famille est identique |
| `--police-titres` | clair | ajoute `'Cormorant Fallback'` | `'Cormorant Garamond', Georgia, serif` | Sans effet : la première famille est identique |

**La divergence d'accent est justifiée — et je l'ai calculée plutôt que de la
croire.** `jetons.css` affirme que `#8a6f38` mesure 4,37:1 sur `--bg2`, sous le
seuil AA, et que `#856b37` le remet au-dessus. Vérification :

| Thème | Périmètre | Accent | Fond | Ratio | Seuil AA |
|---|---|---|---|---|---|
| clair | site et blog | `#8a6f38` | `--bg2` `#f7f5f1` | **4,37:1** | **SOUS LE SEUIL** |
| clair | widget et les trois autres | `#856b37` | `--bg2` `#f7f5f1` | **4,64:1** | conforme |
| sombre | site et blog | `#c9a96e` | `--bg` `#08080c` | 8,93:1 | conforme |
| sombre | widget et les trois autres | `#c9a96e` | `--bg` `#08080c` | 8,93:1 | conforme |

La divergence n'est donc pas un écart : c'est une **correction d'accessibilité
documentée (décision D6)**, et le calcul la confirme au chiffre près.

**Comparaison B — 76 paires vérifiées, 9 divergences** avec la source canonique :

| Jeton | Thème | Valeur du produit | Valeur du noyau | Nature |
|---|---|---|---|---|
| `--arrondi-bloc` | — | `12px` | `--rayon-bloc` = `20px` | **Divergence réelle**, documentée dans `jetons.css` |
| `--red-bg` / `--red-border` (voiles d'erreur) | clair et sombre | `rgba(180,45,45,.06)` et `rgba(180,45,45,.28)` | `color-mix` sur `--erreur` (`168,48,47`) aux mêmes pourcentages | **Divergence réelle** : les deux voiles sont écrits en littéral sur une teinte `180,45,45` là où le noyau compose l'erreur `168,48,47`. La teinte du **texte** (`--red-text` `#a8302f`) est identique des deux côtés |
| `--shadow-gold` | clair | `0 6px 24px rgba(138,111,56,.14)` | `--ombre-accent` = `0 6px 24px color-mix(--accent-halo)` (soit `#856b37` à 28 %) | **Divergence réelle** : couleur littérale ET accent d'avant D6 ET alpha moitié |
| `--gold2` | sombre | `#e2c07a` | `--accent-appuye` = `#cfb583` | **Divergence réelle** |
| `--police-corps`, `--police-titres` | — | `'DM Sans', system-ui, …` | ajoute `'Segoe UI'` / `'Times New Roman'` | Sans effet : ces familles viennent **après** `sans-serif` / `serif`, donc elles ne sont jamais atteintes. Défaut du noyau, pas du produit |

### 1.6 Le SDK est isolé, et c'est vérifié

`src/sdk/entry.ts` porte 10 hexadécimaux et 9 `rgba()` : ce sont les **replis**
(`--gold, var(--ep-sdk-gold)`), c'est-à-dire les valeurs qu'un site hôte qui ne
charge pas les jetons verrait. Le fichier est gelé par contrat, il est mesuré à
part et **n'entre dans aucun compte d'interface**.

---

## 2. Polices auto-hébergées

### 2.1 Déclarations et fichiers

| Périmètre | Déclarations `@font-face` | Familles | Empreinte des déclarations |
|---|---|---|---|
| widget | 9 | Cormorant Garamond, DM Sans | `231a83e63e81…` |
| application Mia | 9 | Cormorant Garamond, DM Sans | `231a83e63e81…` |
| console | 9 | Cormorant Garamond, DM Sans | `231a83e63e81…` |
| pages publiques | **4** | Cormorant Garamond, DM Sans | `97e7bfee5c19…` |
| site | 9 | Cormorant Garamond, DM Sans | `231a83e63e81…` |
| blog | 9 | Cormorant Garamond, DM Sans | `231a83e63e81…` |

Cinq périmètres sur six ont une empreinte de déclarations **identique**. Les
pages publiques en ont 4 : c'est la décision de performance mesurée de la tâche
6.4 (une graisse inutilisée retirée, une graisse en moins sur le numéro
d'étape), et **ce sont les mêmes familles et les mêmes fichiers**.

Empreinte des fichiers `.woff2` (hachage des 9 empreintes de fichier triées) :

| Périmètre | Fichiers | Empreinte du jeu |
|---|---|---|
| widget / application Mia / console / pages publiques | 9 | `cc9762f935dcc1b32ae1230d665cd0de` |
| site | 9 | `cc9762f935dcc1b32ae1230d665cd0de` |
| blog | 9 | `cc9762f935dcc1b32ae1230d665cd0de` |

**Les neuf fichiers sont identiques à l'octet dans les trois dépôts.** Ce n'est
pas une ressemblance, c'est le même contenu.

### 2.2 Zéro référence à une fonderie distante — sauf trois, dans le site

Le balayage couvre les sources, les artefacts compilés (`dist/`) et **la racine
des deux sites** — pas seulement leur dossier `assets`. Ce périmètre élargi
n'était pas le premier choix : une première version ne regardait que
`assets/css` et annonçait « 0 référence ». **C'était faux.**

| Fichier | Ligne | Référence |
|---|---|---|
| `site-eperformance/merci-candidature.html` | 10 | `<link rel="preconnect" href="https://fonts.googleapis.com" />` |
| `site-eperformance/merci-candidature.html` | 11 | `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />` |
| `site-eperformance/merci-candidature.html` | 12 | `<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond…" rel="stylesheet">` |

**Non corrigée** : le fichier appartient au dépôt du site, hors de mon périmètre
d'écriture. Les familles demandées sont les mêmes (`Cormorant Garamond`,
`DM Sans`) — c'est la **livraison** qui est distante, pas la typographie. Le
widget, la console, l'application et les pages publiques : **0 référence**.

---

## 3. Arrondis, couleurs, espacements

### 3.1 Arrondis et durées — échelle comparée, pas seulement jeton par jeton

| Cran | Noyau | Site, blog, widget, console, pages |
|---|---|---|
| champ | `--rayon-champ` = 12px | `--arrondi-input` = 12px |
| bloc | `--rayon-bloc` = **20px** | `--arrondi-bloc` = **12px** |
| carte | `--rayon-carte` = 28px | `--arrondi-carte` = 28px |
| bouton | `--rayon-bouton` = 999px | `--arrondi-bouton` = 999px |

Trois crans sur quatre sont identiques. Le quatrième ne l'est pas : c'est la
divergence `--arrondi-bloc` de §1.5.

Durées : `150ms / 300ms / 600ms` d'un côté, `--duree-rapide / --duree /
--duree-lente` de l'autre — **valeurs identiques**, noms différents. Courbe de
transition : `cubic-bezier(0.16, 1, 0.3, 1)` partout, mesurée dans les cinq
rôles de composants (§7).

### 3.2 Espacements — une échelle existe au noyau, elle n'est pas consommée

| | Nombre de crans | Exemple |
|---|---|---|
| Noyau (`--p-espace-*`) | **8** | `0.25rem`, `0.5rem`, `0.75rem`, `1rem`, `1.5rem`, `2rem`, `2.75rem`, `4rem` |
| Site | 3 | `--section-padding`, `--gutter`, `--gutter-x` — pas une échelle |
| Recettes du widget, de la console et des pages | **0 jeton** | 275 valeurs littérales |

**Ce que ça dit, chiffré** : les recettes d'interface expriment leurs
espacements en littéral, **jamais** par un jeton d'échelle. Sur ces 275
occurrences, **139 tombent sur un cran du noyau** (4, 8, 12, 16, 24, 32, 44,
64 px) et **223 utilisent une valeur hors échelle** (2, 3, 5, 6, 7, 9 px, et des
`rem` intermédiaires).

Ce n'est pas un défaut de rendu : le rythme des recettes est régulier et
volontaire (2/4/6/8 px pour la micro-densité d'un widget de 400 px). C'est un
**écart de vocabulaire** : il n'existe pas d'échelle partagée entre le noyau et
les recettes, et aucune valeur d'espacement n'est verrouillable par un jeton.
Recommandation en §8.

### 3.3 Couleurs littérales — comptées

Périmètre d'interface : `src/style.css`, `src/admin/**`, `src/application.css`,
`application/**`, `index.html`, `admin.html` (fichiers de test exclus).

| Périmètre | Hexadécimales | `rgb()` / `rgba()` |
|---|---|---|
| widget (`src/style.css`) | **0** | **0** |
| console (`src/admin/**`) | **0** | **0** |
| pages publiques | 4 | **0** |
| application Mia (`index.html`) | 2 | **0** |
| `admin.html` | **0** | **0** |
| **TOTAL interface** | **6** | **0** |
| SDK (gelé, hors interface) | 10 | 9 |
| `src/stores/config.ts` (repli documenté) | 2 | 0 |

**Avant / après cette tâche : 6 puis 6, mesuré.** Le « avant » a été compté sur le
commit `2d7be24` (`git show 2d7be24:<fichier>`), pas déduit : `src/style.css`,
`src/application.css`, `admin.html` et `src/admin/**` y portaient déjà 0
hexadécimal et 0 `rgb()` hors fichiers de test, et `index.html` ses 2
`theme-color`. Aucune couleur littérale n'a été ajoutée ni retirée : les trois
chaînes corrigées au §4.1 n'en portaient aucune. Le compte de la tâche 6.3
(47 puis 0 sur la console) reste valide et se lit ici à 0.

La seule occurrence d'hexadécimal dans `src/admin/**` est dans
`outils.spec.ts` (2), **hors périmètre d'interface** : une valeur simulée de
`getComputedStyle`, jamais affichée.

Les 6 hexadécimaux restants sont **tous** des `name="theme-color"` dans
`index.html`, `application/index.html` et `application/mia/index.html` : deux
par fichier, `#fdfcfa` et `#08080c`. Vérifié : **`vaut_le_jeton_bg = true` pour
les six** — ce sont exactement les valeurs de `--bg` en clair et en sombre. Une
balise `<meta>` ne peut pas lire une variable CSS ; la duplication est
techniquement forcée, et la mesure confirme qu'elle ne dérive pas.

---

## 4. Emoji — le compte, et la distinction qui compte

### 4.1 Ce qui a été corrigé

La règle du propriétaire est absolue sur les **chaînes que le produit écrit
lui-même**. Trois l'ont été :

| Fichier | Avant | Après |
|---|---|---|
| `src/stores/messages.ts` (message d'accueil de Mia) | `Bonjour U+1F44B Vous parlez maintenant avec Mia. …` | `Bonjour, vous parlez maintenant avec Mia. …` |
| `src/components/ChatMessages.vue` (bouton de reprise) | `U+21BB Réessayer` | `Réessayer` |
| `src/stores/messages.ts` (repli WhatsApp) | `Continuer sur WhatsApp` suivi du glyphe U+2192 | `Continuer sur WhatsApp` |

La troisième n'a **pas** été trouvée par relecture : c'est la mesure qui l'a
sortie, après que les deux premières eurent été corrigées et que le compte ne
tombait toujours pas à zéro. C'est exactement ce qu'un compte est censé faire.

### 4.2 Le compte avant / après

| Nature | Avant | Après | Décision |
|---|---|---|---|
| **Chaîne d'interface** (ce que le produit écrit) | **4** | **1** | Corrigées : **3** |
| Commentaire de code (jamais rendu) | 59 | 61 | Hors du champ de la règle — voir §4.3 |
| Palette de saisie (emoji que l'utilisateur insère) | 1 | 1 | **Conservée** — voir §4.4 |

La dernière chaîne d'interface est dans `src/sdk/entry.ts:826`
(`'<button type="button" aria-label="Masquer">U+2715</button>'`) : le SDK est **gelé
par contrat**, il n'a pas été touché. Signalé, pas corrigé.

### 4.3 Ce que « emoji » veut dire ici — la définition vient du dépôt

L'expression employée est **celle des tests du dépôt**
(`src/admin/regles.spec.ts`, `src/application/pages.spec.ts`) : plages
`U+1F000-1FAFF`, `U+2190-21FF`, `U+2600-27BF`, `U+2B00-2BFF`, `U+FE0F`,
`U+200D`. Mes chiffres sont donc comparables aux leurs, et la frontière n'est
pas la mienne.

La règle du dépôt est explicite : *« la règle n°8 porte sur ce qui s'AFFICHE, et
une flèche typographique U+2192 dans un commentaire de code n'est pas un emoji
d'interface »*. Les commentaires sont donc **comptés à part** — les 61 restants
sont des flèches U+2192 dans des explications, jamais rendues.

Le classement se fait par **régions de commentaire**, ligne à ligne. Un
détecteur caractère par caractère a été essayé d'abord et s'est trompé :
l'attribut `accept="image/*,.pdf,…"` du champ de pièce jointe ouvre un `/*` qui
n'est pas un commentaire, et le détecteur avalait tout le fichier jusqu'au `*/`
de la section de style — la palette comptait alors 0 au lieu de 1. Le défaut est
noté dans le code, à l'endroit où il se produirait de nouveau.

### 4.4 La palette de saisie — décision au propriétaire, signalée

`src/components/ChatInput.vue:222` déclare une palette de douze caractères,
`const EMOJIS = [...]` — leurs points de code sont relevés dans
`mesures-emoji.json` (nature « palette »), et les voici en clair :
U+1F60A, U+1F44D, U+1F64F, U+1F525, U+1F4AA, U+1F680, U+2764 U+FE0F, U+2705,
U+1F91D, U+1F4C8, U+1F602, U+1F914.

Ce ne sont pas des libellés du produit : c'est une **palette que le visiteur
utilise pour composer SON message**, un outil de saisie au même titre que le
clavier. Elle est couverte par un test (`ChatInput.spec.ts`, « insère un emoji
dans le champ ») et la retirer retirerait une fonctionnalité, pas une décoration.

**Conservée, non modifiée, signalée.** Trois options pour le propriétaire :
garder (un visiteur peut de toute façon taper un emoji), réduire la palette, ou
la retirer en assumant la perte.

---

## 5. Ce que Mia écrit réellement en conversation

**Les consignes données au modèle n'ont pas été modifiées.** La signature de Mia
relève de sa personnalité, et le propriétaire a demandé qu'elle soit conservée.
On mesure donc.

Échantillon : **10 questions posées à l'API de production**
(`POST /api/chatbot/message`), 10 réponses obtenues, aucune erreur.

| Mesure | Valeur |
|---|---|
| Réponses obtenues | **10 / 10** |
| Réponses contenant au moins un emoji | **6 / 10** — **ratio 0,60** |
| Emoji au total dans l'échantillon | **11** |
| Emoji distincts | U+2192, `U+1F44B`, `U+1F50D`, `U+1F642`, `U+1F680` |

**Décomposition honnête, parce que le total seul trompe** : sur ces 11
occurrences, **6 sont une seule flèche U+2192 répétée six fois dans UNE réponse**
(une énumération), et **5 seulement sont des emoji pictographiques**
(`U+1F44B` au message d'accueil, `U+1F50D`, `U+1F680`, et `U+1F642` deux fois). La réponse
d'accueil — « Bonjour U+1F44B » — est celle qu'un visiteur voit le plus souvent.

Exemples mesurés :

- `Bonjour` donne « Bonjour U+1F44B  Comment puis-je t'aider aujourd'hui ? Dis-moi ce qui t'amène. »
- `Merci beaucoup, c'est très clair.` donne « Avec plaisir U+1F642 … »
- `Est-ce que je peux automatiser la relance de mes clients ?` donne 6 fois U+2192, dans une énumération

**Décision demandée au propriétaire** : la règle n°8 s'arrête-t-elle aux chaînes
d'interface, ou s'étend-elle au texte conversationnel ? Ce sont deux endroits
différents — les chaînes d'interface sont corrigées, celui-ci attend un
arbitrage, et le chiffre est là pour l'éclairer.

---

## 6. Ce que la mesure a coûté : quatre erreurs corrigées dans le harnais

Aucune n'a produit de résultat faux dans ce rapport, et chacune est notée dans
le code à l'endroit où elle se reproduirait.

| Erreur | Ce qu'elle produisait | Ce qui l'a rendue visible |
|---|---|---|
| `@media (prefers-reduced-motion) { :root { --duree: 1ms } }` lu comme le thème clair du noyau | Trois fausses divergences de durée | Le noyau « déclarait » 1 ms pour une transition de 300 ms |
| Résolution d'un thème avec la table de l'autre | Neuf fausses divergences noyau et site | Une alerte sombre comparée à une alerte claire |
| `color-mix(X p%, transparent)` non converti en `rgba(X, p)` | Trois faux positifs (voiles d'accent sombres) | Trois divergences pour une seule valeur |
| Détecteur de commentaires caractère par caractère | La palette de saisie comptée comme du code : 0 au lieu de 1 | L'attribut `accept="image/*,.pdf"` ouvrait un faux commentaire |

**Et une erreur de périmètre** : la recherche de fonderie distante ne regardait
que `assets/css` et annonçait « 0 référence » alors que
`merci-candidature.html` en porte trois. Un zéro qui vient d'un périmètre trop
étroit ne vaut rien.

---

## 7. Comparaison côte à côte des mêmes composants

`python3 docs/phase3-tache-6-9/composants.py` lit les valeurs **réellement
calculées** par le moteur de rendu (`getComputedStyle`) de chaque composant,
dans chaque contexte, et les compare propriété par propriété. La planche sert à
voir ; le tableau sert à prouver.

**Planche** : `docs/phase3-tache-6-9/composants-cote-a-cote.png`
**Valeurs** : `docs/phase3-tache-6-9/mesures-composants.json`

### 7.1 Les deux familles de propriétés, et pourquoi elles ne se jugent pas pareil

| Famille | Propriétés | Une différence est… |
|---|---|---|
| **Design system** (10) | rayon, fond, texte, filet (couleur, largeur, style), ombre, famille de police, durée et courbe de transition | une **divergence** : deux écrans devraient parler la même langue |
| **Métier** (8) | `padding`, `font-size`, `font-weight`, `gap`, `min-height`, `letter-spacing`, `line-height` | une **différence attendue** : un bouton de 40 px dans une console dense et un bouton de 54 px sur une page de vente ont raison tous les deux |

Deux normalisations s'appliquent avant de conclure :

- `transition-duration` liste une durée **par propriété animée** : `0.3s, 0.15s`
  et `0.3s, 0.3s, 0.3s, 0.15s` disent la même chose. Sans cette réduction,
  quatre fausses divergences apparaissaient.
- Un rayon de `50%` sur un carré et de `999px` sur un bouton allongé donnent le
  même arrondi complet : on compare l'**effet**, pas la chaîne.

### 7.2 Le tableau

Les divergences sont comptées **par rôle**, pas par contexte : un rôle comparé
entre trois contextes produit une divergence, pas trois.

| Rôle | Contextes | Propriétés système comparées | Divergences système | Différences de métier |
|---|---|---|---|---|
| `bouton-accent` | 3 | 10 | **4** (dont 3 de forme, §7.4) | 7 |
| `bouton-secondaire` | 2 | 10 | **2** | 5 |
| `carte` | 3 | 10 | **2** (dont 1 non significative) | 5 |
| `champ` | **2** | 10 | **0** | 5 |
| `etat-actif` | 2 | 10 | **5** | 5 |
| **Total** | | **50 paires** | **13** | **27** |

Sur les 13 divergences système, **4 ne sont pas des incohérences** : elles
comparent des composants qui ne jouent pas le même rôle (un bouton d'envoi rond
sans filet contre deux boutons étiquetés ; une carte cliquable contre deux
surfaces statiques). Les **9 restantes** sont listées nommément au §7.4 et
reprises au §8.

### 7.3 Le champ de saisie : zéro divergence, et c'est le résultat le plus parlant

| Propriété système | Widget `.ep-input` | Console `.adm-champ` |
|---|---|---|
| `border-radius` | 12px | 12px |
| `background-color` | `rgb(255, 255, 255)` | `rgb(255, 255, 255)` |
| `border-color` | `rgb(143, 138, 126)` (`--border-strong`) | `rgb(143, 138, 126)` (`--border-strong`) |
| `font-family` | DM Sans | DM Sans |
| Ombre, courbe de transition | identiques | identiques |

Deux documents différents, deux entrées Vite différentes, **aucune divergence
sur les 10 propriétés du système**. Les 5 différences de métier sont le
remplissage (`12px` dans le widget, `9px` dans la console) et le corps de texte
(14 px contre 13 px) : la console est plus dense, c'est voulu.

### 7.4 Les 13 divergences, une par une

| # | Rôle | Propriété | Valeurs mesurées | Verdict |
|---|---|---|---|---|
| 1 | `bouton-accent` | `border-width` / `style` / `color` | widget `0px/none/rgb(255,255,255)` · console `1px/solid/#856b37` · pages `1px/solid/transparent` | **Forme différente, pas incohérence** : le widget n'a qu'un bouton d'envoi **rond sans filet**, les deux autres sont des boutons étiquetés |
| 2 | `bouton-accent` | `box-shadow` | widget et pages `rgba(138,111,56,.14) 0 6px 24px` · console `none` | **Divergence réelle** : l'ombre d'accent existe sur deux contextes et pas le troisième — et c'est **la même valeur littérale** que la divergence `--shadow-gold` de §1.5. Deux mesures indépendantes disent la même chose |
| 3 | `bouton-secondaire` | `color` | console `rgb(69,66,75)` (`--soft`) · pages `rgb(22,21,26)` (`--text`) | **Divergence réelle** : la console atténue le libellé, les pages non |
| 4 | `bouton-secondaire` | `border-color` | console `rgb(229,225,217)` (`--border`) · pages `rgb(143,138,126)` (`--border-strong`) | **Divergence réelle, et c'est la plus significative — voir §7.5** |
| 5 | `carte` | `border-radius` | widget 12px · console 12px · pages **28px** | **Divergence réelle** : la page publique emploie `--arrondi-carte` (28), la console et le widget `--arrondi-bloc` (12). Le commentaire de `admin.css` dit « la CARTE porte du contenu — rayon 12 » ; `eperf.css` dit « carte = 28 ». **Le mot « carte » ne désigne pas le même objet des deux côtés** |
| 6 | `carte` | `border-color` | widget `--border-strong` · console et pages `--border` | **Pas une incohérence** : la carte du widget est un **bouton cliquable** (elle prend le filet de contrôle), les deux autres sont des surfaces statiques |
| 7-11 | `etat-actif` | `border-radius` 0 / 12 · `background` transparent / `--gold-bg` · `color` `--gold` / `--gold2` · `border-color` idem · `transition-duration` 300 / 150 ms | widget `0px`, transparent, `--gold`, 300 ms · console `12px`, `--gold-bg`, `--gold2`, 150 ms | **Divergence réelle de convention** : le widget marque l'onglet actif par une **barre d'accent de 3 px** sans fond ; la console par une **trace d'accent** et un fond. Les deux sont documentés et lisibles ; les durées diffèrent de 150 à 300 ms pour le même geste |

### 7.5 Le point qui mérite une décision : le filet du bouton secondaire

Mesuré au §7.4 ligne 4, puis calculé :

| Contexte | Filet | Sur | Ratio | Seuil WCAG 1.4.11 |
|---|---|---|---|---|
| console (`--border`) | `#e5e1d9` | `--card` `#ffffff` | **1,30:1** | sous 3:1 |
| pages (`--border-strong`) | `#8f8a7e` | `--card` `#ffffff` | **3,44:1** | conforme |
| console, thème sombre | `#1c1c22` | `#101014` | **1,12:1** | sous 3:1 |
| pages, thème sombre | `#646470` | `#101014` | **3,25:1** | conforme |

La console et les pages font le **même travail** — un bouton secondaire bordé —
avec deux jetons différents. Ce n'est pas nécessairement une **non-conformité**
au sens strict : 1.4.11 exige 3:1 pour un contrôle dont la frontière est le seul
moyen de l'identifier, et un bouton qui porte un libellé est identifié par son
libellé. C'est une **incohérence entre deux écrans du même produit**, mesurée au
chiffre, et c'est au propriétaire de trancher.

---

## 8. Divergences : ce qui est corrigé, ce qui ne l'est pas, et pourquoi

| # | Divergence | Mesure | Corrigée ? | Pourquoi |
|---|---|---|---|---|
| 1 | Emoji dans 3 chaînes d'interface | 4 puis 1 | **Oui** | Explicitement demandé par la tâche |
| 2 | Accent clair `#8a6f38` sous AA sur `--bg2` | 4,37:1 (site) vs 4,64:1 (widget) | Non | Déjà corrigée côté widget par la décision D6, **calculée et confirmée**. Corriger le site changerait sa charte : décision du propriétaire |
| 3 | `--arrondi-input` 10px (site) vs 12px (widget) | 2 valeurs | Non | Corriger changerait le rendu du champ du widget **en production**, ou du site. Signalé depuis 6.4, arbitrage au propriétaire |
| 4 | `--arrondi-bloc` 12px vs noyau 20px | 2 valeurs | Non | Documenté dans `jetons.css` (« c'est la valeur retenue pour les blocs du widget »). Changer changerait le produit |
| 5 | `--gold2` clair `#8f7238` (site) vs `#735d32` (widget) ; sombre `#e2c07a` (widget) vs `#cfb583` (noyau) | 4 valeurs | Non | Le widget suit le noyau en clair et s'en écarte en sombre. Ce n'est pas à moi de modifier un accent |
| 6 | Voiles d'erreur composés sur `180,45,45` au lieu de `168,48,47` (`--erreur`) | 4 valeurs | Non | Écart de teinte faible, mais littéral : la valeur devrait venir d'un `color-mix` sur le jeton |
| 7 | `--shadow-gold` littéral `rgba(138,111,56,.14)` au lieu de `--accent-halo` | 2 valeurs + l'ombre absente de la console | Non | Même valeur littérale retrouvée par deux mesures indépendantes |
| 8 | Filet du bouton secondaire : `--border` (console) vs `--border-strong` (pages) | 1,30:1 vs 3,44:1 | Non | Incohérence réelle ; choisir le jeton change l'aspect de la console. **Décision du propriétaire** |
| 9 | « Carte » ne désigne pas le même rayon selon le contexte | 12px vs 28px | Non | Vocabulaire à trancher : soit `admin.css` suit `eperf.css`, soit l'inverse |
| 10 | Durée d'état actif 300 ms (widget) vs 150 ms (console) | 2 valeurs | Non | Écart de mouvement, sans conséquence d'accessibilité |
| 11 | Espacements : aucune valeur d'échelle consommée | 275 littérales, 139 sur l'échelle | Non | Introduire 8 jetons d'espacement dans 275 emplacements est une tâche à part entière, et changerait le rendu |
| 12 | 3 références Google Fonts dans `merci-candidature.html` | 3 | Non | **Hors périmètre d'écriture** (dépôt du site) |
| 13 | 1 emoji dans `src/sdk/entry.ts` | 1 | Non | **SDK gelé par contrat** |

**Aucune de ces divergences n'affecte le rendu du widget en production** : le
widget, la console, l'application Mia et les pages publiques partagent une
empreinte de jetons identique (§1.3). Les écarts sont **entre le produit et le
site**, ou entre deux intentions de design — jamais à l'intérieur du produit.

---

## 9. Verdict de cohérence, écran par écran

| Écran / contexte | Jetons | Polices | Couleurs littérales | Emoji d'interface | Composants mesurés | **Verdict** |
|---|---|---|---|---|---|---|
| **Widget visiteur** (5 vues) | empreinte `e1fc5554…` | 9 déclarations, `231a83e6…` | **0 hex, 0 rgb** | **0** | `bouton-accent`, `carte`, `champ` (0 divergence), `etat-actif` | **COHÉRENT** |
| **Console** (11 modules) | `e1fc5554…` — identique au widget | 9 déclarations, `231a83e6…` | **0 hex, 0 rgb** | **0** | `bouton-accent`, `bouton-secondaire`, `carte`, `champ` (0 divergence), `etat-actif` | **COHÉRENT**, avec 2 points à trancher (§7.5 et divergence 5) |
| **Application Mia** (5 vues) | `e1fc5554…` — identique | 9 déclarations, `231a83e6…` | 2 hex (`theme-color` = `--bg`) | **0** | mêmes recettes que le widget | **COHÉRENT** |
| **Pages publiques** (`/application`, `/application/mia`) | `e1fc5554…` — identique | 4 déclarations (décision 6.4), **mêmes familles, mêmes fichiers** | 4 hex (`theme-color` = `--bg`) | **0** | `bouton-accent`, `bouton-secondaire`, `carte` | **COHÉRENT**, 2 écarts de vocabulaire nommés |
| **Site** `eperformance.pro` | `cebe50ea…` — diverge du produit sur 8 jetons, dont 4 justifiés par D6 | identique (mêmes fichiers) | non compté, hors périmètre d'écriture | 3 références Google Fonts sur 1 page | non mesuré ici | **À TRAITER PAR LE SITE** : accent sous AA, `--arrondi-input`, fonderie distante |
| **Blog** `blog.eperformance.pro` | `cebe50ea…` — identique au site | identique | non compté | 0 | non mesuré ici | **COHÉRENT AVEC LE SITE** (même `eperf.css`, même MD5 `3fa9c37e…`) |
| **SDK** (gelé) | 10 hex + 9 rgb de repli | — | isolé, hors interface | 1 (`U+2715`) | — | **GELÉ**, signalé |

**Les trois rôles marqués « 0 divergence »** — `champ` au widget, `champ` à la
console, `champ` comparé entre les deux — portent sur 10 propriétés de design
system chacune. C'est le résultat le plus parlant du lot : deux documents, deux
entrées de build différentes, aucune divergence.

**Le produit est cohérent avec lui-même.** Les quatre contextes du dépôt
`eperformance-widget` — widget, console, application Mia, pages publiques —
partagent la même empreinte de jetons, les mêmes fichiers de police et zéro
couleur littérale d'interface. Les écarts restants sont entre le produit et le
site, ou entre deux intentions documentées.

---

## 10. Rejouer les mesures

```bash
cd /home/ballo/OX6A/toolkit_eperformance/eperformance-widget
python3 docs/phase3-tache-6-9/mesures.py            # jetons, polices, échelles, emoji, Mia
python3 docs/phase3-tache-6-9/mesures.py jetons     # une mesure
python3 docs/phase3-tache-6-9/composants.py         # planche + valeurs par composant
npm test                                            # 296 tests
```

`mesures.py` n'écrit rien en dehors de `docs/phase3-tache-6-9/` et ne modifie
aucun fichier. La mesure `mia` interroge l'API de production en lecture seule.
Le « avant » des emoji est lu dans l'historique Git (`fcd9df0^`), pas dans une
copie : un avant recopié finit par diverger.

---

## 11. Commits

| Commit | Sujet |
|---|---|
| `fcd9df0` | `fix(widget): les chaînes d'interface ne portent plus d'emoji` |
| `db8daa8` | `fix(widget): le libellé WhatsApp ne porte plus de flèche décorative` |
| `docs(6.9)` | mesures de cohérence, planche des composants et ce rapport |
