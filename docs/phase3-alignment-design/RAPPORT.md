# Alignement design phase 3 — cinq décisions, cinq corrections

Cinq écarts entre deux contextes du MÊME produit, tranchés par le
propriétaire sur le rapport de cohérence de la tâche 6.9, et corrigés ici.

Ce document ne redémontre pas ce que 6.9 a établi : il part de son §8 et
n'écrit que ce qui a changé depuis. Les chiffres donnés ici sont **recalculés**
par les harnais de ce dossier, qui **importent** ceux de 6.9 au lieu de les
réécrire — deux implémentations de la même formule finissent par diverger, et
deux chiffres contradictoires valent moins qu'un seul chiffre reproductible.

| Harnais | Ce qu'il fait | Réutilise |
|---|---|---|
| `contrastes.py` | les ratios WCAG avant / après | `mesures.py` de 6.9 (lecture des jetons, résolution `var()`, `color-mix()` → `rgba()`, luminance, ratio) |
| `preuve-d7d.py` | la preuve du renommage D7d | le serveur, le jeu d'essai et le jeton de `composants.py` de 6.9 |
| `voiles-erreur.py` | les captures des voiles d'erreur | idem, plus la panne provoquée |
| `planche-alignement.py` | la planche avant / après | les captures des deux précédents |

```bash
cd /home/ballo/OX6A/toolkit_eperformance/eperformance-widget
python3 docs/phase3-alignment-design/contrastes.py avant     # ou `apres`
python3 docs/phase3-alignment-design/preuve-d7d.py comparer avant apres
python3 docs/phase3-alignment-design/preuve-d7d.py css
python3 docs/phase3-tache-6-9/mesures.py jetons               # empreintes
python3 docs/phase3-tache-6-9/composants.py                   # les cinq rôles
```

---

## 1. Les cinq corrections, et ce qui a changé pour chacune

### D4 — Filet du bouton secondaire

**Ce qui change.** Dans `src/admin/**`, le filet des **boutons secondaires
bordés** passe de `--border` (#e5e1d9) à `--border-strong` (#8f8a7e). Deux
éléments portent ce rôle, et deux seulement :

| Fichier | Sélecteur | Avant | Après |
|---|---|---|---|
| `src/admin/admin.css` | `.adm-btn--discret` | `--border` | `--border-strong` |
| `src/admin/components/Header.vue` | `.adm-entete__bouton` | `--border` | `--border-strong` |

`.adm-entete__bouton` (menu, notifications, profil) n'était pas dans la mesure
de 6.9, mais c'est **le même rôle** : bouton bordé, rayon de pilule, même
survol. N'en corriger qu'un aurait laissé le défaut deux centimètres plus haut,
dans le même écran.

**Ce qui ne change pas, et pourquoi.** `--border` reste partout ailleurs :
`.adm-bloc`, `.adm-ligne`, `.adm-tableau-cadre`, `.adm-panneau`,
`.adm-boite__volet`, `.adm-barre__pied`, `.ep-login__card` (surfaces) ;
séparateurs de tableaux, de messages et de pieds de bloc ; `.adm-badge` et
`.adm-article__tag` (étiquettes) ; `.adm-vide` (filet en pointillés). Ce sont
des filets **décoratifs** : WCAG 1.4.11 ne leur demande rien, et les foncer
changerait l'aspect de onze modules pour aucun gain. C'est exactement la
distinction que le noyau écrit dans ses primitives — `--p-neutre-3` est le
« filet décoratif », `--p-neutre-6` la « bordure de contrôle
(3,44:1 sur blanc) », `10-primitives.css:36` et `:39`.

**Vérifié contre la source canonique.** Les deux ratios attendus sont ceux que
le noyau donne lui-même : 3,44:1 en clair (`10-primitives.css:39`) et 3,25:1 en
sombre (`10-primitives.css:54`). Ils sont obtenus, pas supposés (§4). Et le
geste n'est pas une invention : le widget le fait déjà pour son champ de saisie,
avec la raison écrite à côté — `src/style.css:484-486`, « `--border-strong` et
non `--border` : un champ est un Contrôle au sens de WCAG 1.4.11 (3:1
obligatoire) ». D4 ne fait qu'appliquer la règle déjà posée à un rôle qui
l'avait manquée.

### D7a — Voiles d'erreur

**Ce qui change.** Dans `src/styles/jetons.css`, les deux voiles d'erreur
composent `--erreur` au lieu d'écrire un littéral :

| Jeton | Avant | Après |
|---|---|---|
| clair `--red-text` | `#a8302f` | `var(--erreur)`, avec `--erreur: #a8302f` |
| clair `--red-border` | `rgba(180, 45, 45, 0.28)` | `color-mix(in srgb, var(--erreur) 28%, transparent)` |
| clair `--red-bg` | `rgba(180, 45, 45, 0.06)` | `color-mix(in srgb, var(--erreur) 6%, transparent)` |
| sombre `--red-text` | `#e07070` | `var(--erreur)`, avec `--erreur: #e07070` |
| sombre `--red-border` | `rgba(220, 60, 60, 0.3)` | `color-mix(in srgb, var(--erreur) 30%, transparent)` |
| sombre `--red-bg` | `rgba(220, 60, 60, 0.12)` | `color-mix(in srgb, var(--erreur) 12%, transparent)` |

**Vérifié contre la source canonique.** Le noyau déclare `--erreur` puis en
dérive les trois écritures : `--red-text: var(--erreur)`, `--red-border:
var(--erreur-filet)`, `--red-bg: var(--erreur-trace)` (`20-semantic.css:228-230`),
avec `--erreur-trace` / `--erreur-filet` composés sur `--p-etat-erreur-clair`
(168, 48, 47) à 6 % et 28 % (`:100-101`). La structure du widget copie
désormais celle du noyau : la teinte est dite **une fois**, et un changement de
teinte ne peut plus en oublier une.

Le thème sombre ne se contentait pas d'un littéral : il portait une teinte
(220, 60, 60) qui n'est pas celle du noyau, dont l'erreur sombre vaut `#e07070`
(`10-primitives.css:104`). Il suit maintenant la même teinte, aux pourcentages
du noyau sombre (30 % / 12 %, `20-semantic.css:317-318`).

**Le jeton `--erreur` est ajouté, et c'est la règle qui l'autorise.** La
consigne est de ne créer un jeton que si la source canonique en déclare un
qu'on n'utilisait pas : c'est le cas. Le noyau le déclare, le harnais de 6.9 le
sait déjà (`CORRESPONDANCES` : `--red-text` → `--erreur`, `--red-border` →
`--erreur-filet`, `--red-bg` → `--erreur-trace`), et le widget ne l'utilisait
pas.

### D7b — Ombre d'accent

**Ce qui change.**

| Jeton | Avant | Après |
|---|---|---|
| clair `--shadow-gold` | `0 6px 24px rgba(138, 111, 56, 0.14)` | `0 6px 24px var(--gold-glow)` |
| sombre `--shadow-gold` | `0 8px 32px rgba(201, 169, 110, 0.15)` | **déclarée une seule fois** : la ligne sombre disparaît |
| `src/admin/admin.css` `.adm-btn--or` | pas d'ombre | `box-shadow: var(--shadow-gold)` |

**Vérifié contre la source canonique.** Le noyau écrit
`--ombre-accent: 0 6px 24px var(--accent-halo)` **une fois** (`20-semantic.css:160`)
et ne redéfinit en sombre que `--accent-halo` (`:302`). La géométrie de l'ombre
d'accent ne change donc jamais d'un thème à l'autre ; seule la teinte du halo
change. Le widget, lui, changeait les deux : 8 px / 32 px en sombre, une
géométrie que le noyau n'a jamais eue. Supprimer la redéclaration suffit à le
ramener dans le rang, puisque `--gold-glow` est déjà redéfini pour le sombre.

`--gold-glow` **est** `--accent-halo` côté widget : `--gold` vaut `--p-accent-clair`
(`#856b37`) puis `--p-accent-sombre` (`#c9a96e`), et les pourcentages sont les
siens (28 % / 40 %). Aucun jeton nouveau n'est donc nécessaire ici.

**Décision demandée : l'ombre est AJOUTÉE à la console.** Justification au §2.

### D7c — Durée d'état actif

**Ce qui change.**

| Fichier | Sélecteur | Avant | Après |
|---|---|---|---|
| `src/admin/components/Sidebar.vue` | `.adm-lien` | `var(--t-fast)` (150 ms) | `var(--t)` (300 ms) |
| `src/admin/views/ConversationsView.vue` | `.adm-boite__item` | `var(--t-fast)` | `var(--t)` |

`var(--t)` **est** le jeton de durée du produit : `jetons.css:16` documente
son équivalence avec `--duree` du noyau, et le noyau vaut 300 ms
(`10-primitives.css:174`). Aucun littéral n'est introduit — et aucun ne
subsistait : `--t-fast` était déjà un jeton, il n'était simplement pas le bon
pour cet état.

Les deux éléments sont traités ensemble parce qu'ils portent **le même état** :
le module courant dans la barre latérale, la conversation sélectionnée dans la
boîte de réception. En aligner un seul aurait laissé la divergence debout
**à l'intérieur** de la console.

**Ce qui n'est pas touché.** `.adm-resultat--actif` (résultat survolé à la
flèche dans la recherche globale) ne déclare aucune transition : ce survol est
piloté au clavier et doit porter l'information tout de suite ; une transition
de 300 ms y serait un délai, pas une harmonisation. `.adm-entete__bouton` garde
`--t-fast` : c'est un retour de survol, pas un état de sélection.

### D7d — Vocabulaire « carte »

**Ce qui change.** Le concept d'`admin.css` change de nom, pas de rayon.

| Avant | Après |
|---|---|
| `.adm-carte` | `.adm-bloc` |
| `.adm-carte--lien` | `.adm-bloc--lien` |
| « la CARTE porte du contenu — rayon 12 » | « le BLOC DENSE porte du contenu — rayon 12 », plus « la CARTE se pose sur la page — rayon 28 » |

Onze occurrences de gabarit dans six vues mises à jour, plus les trois règles.
`grep -rn "adm-carte" src/` ne rend plus rien.

**Pourquoi renommer plutôt qu'aligner.** L'autre branche de l'alternative était
de faire suivre `admin.css` et de passer ces conteneurs à 28 px, comme le
noyau. C'aurait été changer le rendu de onze modules pour résoudre un problème
de **mot** : `--arrondi-bloc` vaut 12 px dans `eperf.css:148`, c'est la valeur
retenue pour les blocs du produit, et le rapport 6.9 l'a documentée comme telle.
Le désaccord n'était pas sur la valeur, il était sur le mot : « carte »
désignait un objet à 12 px dans `admin.css` et un objet à 28 px au noyau
(`--rayon-carte` = `--p-rayon-lg`, `20-semantic.css:139`). Un développeur qui
lit `.adm-carte { border-radius: var(--arrondi-bloc) }` conclut que « carte »
vaut 12, et se trompe dès qu'il touche aux vraies cartes du produit.

Le mot « carte » est donc rendu à son seul sens : le rayon 28, comme au noyau
et comme sur les pages publiques (`.card`). La console en a d'ailleurs une, et
elle l'utilise déjà correctement : `.ep-login__card`, `LoginView.vue:99`.

**Preuve que le rendu ne change pas d'un pixel — §5.**

### D7e — hors périmètre

Les 275 valeurs d'espacement littérales ne sont **pas** touchées : elles seront
traitées dans une tâche à part après la phase 4, comme demandé.

---

## 2. Justification du choix pour D7b : la console reçoit l'ombre

Quatre raisons, dans l'ordre où elles pèsent.

**1. Le noyau ne pose `--ombre-accent` que sur deux rôles, et l'un est le bouton
d'accent.** Vérifié dans `40-components.css` : `.btn-accent` (ligne 111) et
`.plan.is-featured` (ligne 565). L'ombre n'est donc pas un ornement de page de
vente — c'est la marque du bouton d'accent. La console fait ce travail avec
`.adm-btn--or` ; elle doit porter la marque du rôle.

**2. Les deux autres contextes du produit la portent déjà.** Le widget
(`.ep-send`, `src/style.css:518`) et les pages publiques (`.btn-gold`,
`src/application.css:382`). La console était la seule des trois à ne pas
l'avoir — c'est précisément la divergence que 6.9 avait mesurée (§7.4, ligne 2 :
« l'ombre d'accent existe sur deux contextes et pas le troisième, et c'est la
même valeur littérale que la divergence `--shadow-gold` »).

**3. L'argument de densité ne résiste pas à la mesure.** L'objection naturelle
est celle de l'information : une console ne doit pas concurrencer ses données.
Mais `.adm-btn--or` est le bouton d'action **principal**, et il n'apparaît que
**deux fois dans les onze modules** — les deux dans la boîte de réception
(`ConversationsView.vue:140` et `:180`). Il n'y a donc aucun empilement de
halos possible. La densité d'une console vient de ses tableaux, de ses listes et
de ses étiquettes ; elle ne vient pas de son unique action. Et le contraste
mesuré entre les deux contextes le confirme : ce sont les mêmes composants
denses qui diffèrent (padding 16 px contre 28 px sur les conteneurs), pas les
boutons.

**4. Une ombre qui suivrait le contexte contredirait la raison d'être du
jeton.** `--shadow-gold` est un jeton du design system : il dit « le bouton
d'accent se pose au-dessus du plan ». S'il devait disparaître quelque part, il
disparaîtrait **partout**, pas dans un contexte sur trois — sinon ce n'est plus
un jeton, c'est une préférence locale, et la prochaine divergence sera
invisible.

**Contrepartie assumée.** La console gagne une ombre sur son bouton principal,
donc un peu de relief là où elle était strictement plate. C'est le prix de
l'alignement, et il porte sur deux boutons dans onze modules.

---

## 3. Captures avant / après

Toutes dans `docs/phase3-alignment-design/`. La planche
`planche-avant-apres.png` met les sept comparaisons côte à côte, étiquetées.

| Décision | Avant | Après | Ce qu'on y voit |
|---|---|---|---|
| **D4** | `composants-avant/console-bouton-secondaire.png` | `composants-apres/console-bouton-secondaire.png` | le filet d'« Actualiser » s'assombrit et devient visible |
| **D7a** | `voiles-avant/console-adm-erreur-light.png` | `voiles-apres/console-adm-erreur-light.png` | la trace d'erreur tire vers le rouge du jeton |
| **D7a** | `voiles-avant/console-adm-erreur-dark.png` | `voiles-apres/console-adm-erreur-dark.png` | idem en sombre, teinte plus claire |
| **D7a** | `voiles-avant/console-login-erreur-dark.png` | `voiles-apres/console-login-erreur-dark.png` | le refus de connexion |
| **D7b** | `composants-avant/widget-bouton-accent.png` | `composants-apres/widget-bouton-accent.png` | halo de l'accent retenu, à 28 % |
| **D7b** | `composants-avant/pages-bouton-accent.png` | `composants-apres/pages-bouton-accent.png` | idem, pages publiques |
| **D7b** | `composants-avant/console-bouton-accent.png` | `composants-apres/console-bouton-accent.png` | l'ombre **ajoutée** au bouton principal |
| **D7d** | `preuve-d7d-avant/` (22 captures) | `preuve-d7d-apres/` (22 captures) | les onze modules, deux thèmes |

**D7c n'a pas d'image, et c'est un résultat.** 150 ms et 300 ms donnent la même
image à l'arrêt : la durée se mesure, elle ne se photographie pas. C'est le
harnais de composants qui la donne — `transition-duration` du rôle `etat-actif`
de la console passe de `0.15s, 0.15s` à `0.3s, 0.3s`, soit exactement la valeur
du widget.

Les captures des voiles d'erreur sont prises en **provoquant une vraie panne** —
500 sur `/admin/stats`, 401 sur `/api/auth/login` — pas en injectant un état.
Deux composants portent ce voile dans tout le produit, et ce sont les deux
seuls : `.adm-erreur` (neuf modules) et `.ep-login__error`.

---

## 4. Ratios de contraste mesurés, avant et après

Tous recalculés par `contrastes.py`, qui importe le moteur de 6.9. Aucun n'est
recopié.

### D4 — le filet du bouton secondaire

Le bouton secondaire de la console a un fond transparent : le filet porte donc
seul la frontière, sur toutes les surfaces où il peut se trouver. Les six sont
mesurées, pas seulement celle de la mesure de 6.9.

| Thème | Surface | `--border` (avant) | `--border-strong` (après) | Seuil |
|---|---|---|---|---|
| clair | `--bg` #fdfcfa | 1,27:1 | **3,36:1** | 3:1 (1.4.11) |
| clair | `--bg2` #f7f5f1 | 1,20:1 | **3,16:1** | 3:1 |
| clair | `--card` #ffffff | **1,30:1** | **3,44:1** | 3:1 |
| sombre | `--bg` #08080c | 1,18:1 | **3,43:1** | 3:1 |
| sombre | `--bg2` #0c0c10 | 1,15:1 | **3,35:1** | 3:1 |
| sombre | `--card` #101014 | **1,12:1** | **3,25:1** | 3:1 |

Les deux valeurs attendues sont obtenues au chiffre près : **3,44:1 en clair**
et **3,25:1 en sombre** sur `--card`, exactement celles que le noyau annonce
(`10-primitives.css:39` et `:54`). Les quatre autres surfaces passent 3:1 également —
le point qui n'était pas garanti, et qui l'est maintenant, puisque `--bg2` est
la surface la plus claire sur laquelle le bouton peut reposer.

### D7a — les voiles d'erreur

| Thème | Mesure | Avant | Après |
|---|---|---|---|
| clair | `--red-bg` composé sur `--card` | `#faf2f2` | `#faf3f3` |
| clair | `--red-border` composé sur `--card` | `#eac4c4` | `#e7c5c5` |
| clair | écart du filet avec la surface | 1,59:1 | 1,59:1 |
| clair | `--red-text` sur `--bg` | 6,55:1 | 6,55:1 |
| clair | `--red-text` sur son propre voile | 6,09:1 | 6,13:1 |
| sombre | `--red-bg` composé sur `--card` | `#281519` | `#291c1f` |
| sombre | `--red-border` composé sur `--card` | `#4d1d20` | `#4e2d30` |
| sombre | écart du filet avec la surface | 1,37:1 | 1,57:1 |
| sombre | `--red-text` sur `--bg` | 6,40:1 | 6,40:1 |
| sombre | `--red-text` sur son propre voile | 5,55:1 | 5,25:1 |

L'écart est faible et c'est le résultat attendu : la teinte (180, 45, 45) et la
teinte (168, 48, 47) sont deux rouges voisins. Ce qui change n'est pas ce qu'on
voit, c'est **d'où la valeur vient** — et en sombre, où la teinte change davantage
(220, 60, 60) → (224, 112, 112), le filet gagne au passage en visibilité
(1,37:1 → 1,57:1) sans sortir de sa retenue.

Le texte d'erreur reste au-dessus de AA dans les deux thèmes, sur toutes les
surfaces et sur son propre voile (5,25:1 au plus bas).

### D7b — l'ombre d'accent

Une ombre n'a pas de seuil WCAG : ce n'est ni un texte, ni la frontière d'un
contrôle. Ce qui se mesure, c'est sa composition.

| Thème | Avant | Après |
|---|---|---|
| clair | halo `rgba(138, 111, 56, 0.14)` — l'accent d'avant D6 | halo `rgba(133, 107, 55, 0.28)` — l'accent retenu, alpha du noyau |
| clair | composé sur `--bg` : `#ede8df` | composé sur `--bg` : `#dbd3c3` |
| sombre | `0 8px 32px`, halo `rgba(201, 169, 110, 0.15)` | `0 6px 24px`, halo `rgba(201, 169, 110, 0.40)` |
| sombre | composé sur `--bg` : `#25201b` | composé sur `--bg` : `#554833` |

### D7c — durée d'état actif

Ce n'est pas un ratio. Valeurs mesurées sur le rôle `etat-actif` :

| Contexte | Avant | Après |
|---|---|---|
| widget (`.ep-tab--actif`) | `0.3s, 0.3s` | `0.3s, 0.3s` — inchangé, c'est la référence |
| console (`.adm-lien--actif`) | `0.15s, 0.15s` | **`0.3s, 0.3s`** |

---

## 5. Preuve que D7d n'a pas changé le rendu

Le rendu est entièrement déterminé par le DOM, la cascade CSS et le moteur. La
preuve porte donc sur la cascade : **tous les éléments** des onze modules, dans
les deux thèmes, avec **toutes leurs propriétés calculées** et leur géométrie.

| Preuve | Instrument | Résultat |
|---|---|---|
| **Cascade** | empreinte SHA-256 du DOM complet · 22 vues (11 modules × 2 thèmes) · 199 à 303 éléments chacune | **22 / 22 identiques** |
| **Octets** | `admin-DAGd3vKw.css` (avant) contre `admin-Bh-qZlnd.css` (après), substitution inverse appliquée | **identiques à l'octet** |
| **Gabarits** | `admin-CkMLMrU8.js` compilé | `adm-carte` = **0**, `adm-bloc` = 12 |
| **Planche** | 22 captures avant contre 22 après | 17 identiques à l'octet ; 5 à **1 niveau sur 255**, sur 81 pixels **au total** |

**Pourquoi pas une comparaison de captures seule.** Elle a été essayée en
premier, et elle ne prouve rien ici : deux exécutions du **même** build, sur la
même machine, divergent de 1 à 9 niveaux sur quelques dizaines de pixels
(lissage des icônes SVG). Le bruit est du même ordre que ce qu'un renommage raté
produirait sur une bordure — la mesure ne distinguerait pas le signal du bruit.
Ni `--deterministic-mode` (qui bloque la capture Playwright), ni le profil de
couleur, ni la désactivation du GPU ne le font taire. Un instrument dont on ne
connaît pas le bruit ne prouve rien.

**Le bruit de l'instrument est donc mesuré, et publié.**

| Comparaison | Cascade | Captures |
|---|---|---|
| **avant ↔ après** (ce qu'on veut prouver) | 22 / 22 | 17 / 22 à l'octet · 81 px · delta max **1**/255 |
| **témoin ↔ témoin** (même source, deux exécutions) | 22 / 22 | 13 / 22 à l'octet · 149 px · delta max **9**/255 |

La comparaison qui prouve est **plus propre que son propre témoin** : les 81
pixels qui ont bougé entre avant et après le sont moins que ceux qui bougent
entre deux exécutions du même code. Un renommage raté aurait fait disparaître un
rayon, un filet ou une surface — et la cascade l'aurait dit.

Les classes sont **normalisées avant empreinte** (`adm-carte` et `adm-bloc`
ramenés au même mot neutre) : c'est ce qui doit changer qui est neutralisé, et
l'empreinte qui le contiendrait échouerait par construction.

**Ce que la preuve par octets ajoute.** Les deux fichiers CSS construits sont
identiques **caractère pour caractère** une fois la substitution inverse
appliquée, et le JavaScript compilé ne porte plus aucune occurrence de l'ancien
nom. Le renommage est donc **complet** : aucune occurrence oubliée dans un
gabarit ne peut laisser un élément sans style. Deux écritures sont neutralisées
avant comparaison, et une seule est un effet du renommage :

- `adm-bloc` → `adm-carte`, la substitution inverse de D7d ;
- `data-v-…` → `data-v-MASQUE`, la portée des styles Vue. Son nom dérive du
  contenu du fichier `.vue` : renommer la classe a donc changé la portée de
  `Sidebar.vue`. Un sélecteur d'attribut de portée ne porte aucune propriété —
  la preuve de cascade le montre séparément — et le build est par ailleurs
  reproductible : deux compilations de la même source donnent le même fichier,
  octet pour octet.

---

## 6. Tests de non-régression

| Mesure | Avant | Après |
|---|---|---|
| `npm test` (vitest) | **296** | **296** |
| Fichiers de test | 17 | 17 |
| `src/sdk/` | **gelé, non touché** | gelé, non touché |

Aucun test n'exerçait les noms de classe renommés : vérifié avant de renommer,
`grep -rn "adm-carte" src/**/*.spec.ts` ne rendait rien. Le renommage D7d est
donc passé sans toucher un seul test — ce qui est le bon résultat, pas une
chance.

**Empreinte des jetons déclarés** — l'exigence de cohérence. Le fichier
`src/styles/jetons.css` est la seule feuille du dépôt qui déclare des jetons ;
les quatre contextes consomment donc littéralement la même source.

| Périmètre | jetons clair / sombre | empreinte clair | empreinte sombre |
|---|---|---|---|
| widget | 55 / 42 | `51fffc2caf9255fa…` | `2e5e6964d804db5f…` |
| console | 55 / 42 | `51fffc2caf9255fa…` | `2e5e6964d804db5f…` |
| application Mia | 55 / 42 | `51fffc2caf9255fa…` | `2e5e6964d804db5f…` |
| pages publiques | 55 / 42 | `51fffc2caf9255fa…` | `2e5e6964d804db5f…` |

**Les quatre empreintes sont strictement identiques**, dans les deux thèmes.
Elles valaient `e1fc55546b5ce00a…` avant : la valeur a changé parce que D7a
ajoute `--erreur` et que D7a, D7b déplacent des valeurs — **la propriété qui
compte, l'identité entre les quatre contextes, est conservée**. Les jetons
déclarés passent de 54 à 55 en clair (le seul ajout : `--erreur`).

**Couleurs littérales d'interface** : **6**, inchangé — et ce sont exactement
les six `theme-color` de `index.html`, `application/index.html` et
`application/mia/index.html`, deux par fichier (`#fdfcfa` et `#08080c`). Une
balise `<meta>` ne peut pas lire une variable CSS ; ces six valeurs valent
`--bg` et sont laissées telles quelles. Deux littéraux hors interface sont
documentés au §7.

**Emoji d'interface du produit** : **0**. Le seul restant est dans
`src/sdk/entry.ts`, gelé par contrat et hors interface. Aucun emoji n'a été
ajouté : vérifié fichier par fichier, les deux flèches `→` apparues dans le
compte des commentaires viennent de `ChatMessages.vue` et `stores/messages.ts`,
que cette tâche n'a pas touchés.

**Durées littérales sur l'état actif** : **aucune**. Les seuls littéraux de
durée du produit sont les `1ms !important` des blocs
`prefers-reduced-motion` de `src/style.css` et `src/application.css` — c'est le
motif d'accessibilité correct, pas une valeur de design.

---

## 7. Écarts documentés — ce qui n'a pas été corrigé, et pourquoi

### Conséquence à traiter par le site : trois jetons où le produit est désormais en avance

C'est l'effet le plus important de cette tâche, et il faut le dire nettement.
Le site `eperformance.pro` et le blog partagent avec le produit une partie de
leurs jetons. **Après D7a et D7b, trois d'entre eux divergent** — et cette fois
c'est le produit qui a raison, parce qu'il suit le noyau :

| Jeton | Site et blog | Produit | Qui est conforme au noyau |
|---|---|---|---|
| clair `--red-bg` | `rgba(180, 45, 45, 0.06)` | `rgba(168, 48, 47, 0.06)` | **le produit** |
| clair `--red-border` | `rgba(180, 45, 45, 0.28)` | `rgba(168, 48, 47, 0.28)` | **le produit** |
| sombre `--red-bg` / `--red-border` | `rgba(220, 60, 60, …)` | `rgba(224, 112, 112, …)` | **le produit** |
| clair `--shadow-gold` | `0 6px 24px rgba(133, 107, 55, 0.14)` | `0 6px 24px color-mix(in srgb, #856b37 28%, transparent)` | **le produit** |

Hors périmètre d'écriture de cette tâche : je lis le site, je ne l'écris pas.
Le blog et le site partagent le même fichier — `assets/css/eperf.css`, MD5
`5fe2150f1568bbe138a119e9ea4cf458` des deux côtés, vérifié — donc les deux sont
concernés, et une seule correction les traitera tous les deux.

À noter : le site a **déjà** pris la décision D6 de son côté
(`213a333 fix(design): aligne --gold, --gold2 et --arrondi-input sur le widget`)
— sur `--gold`, `--gold2` et `--arrondi-input`, les divergences de la tâche 6.9
ont disparu. Il reste ces quatre-là.

### Divergences produit / noyau : 9 → 4

Le rapprochement est mesuré, pas affirmé. Ce qui reste, et pourquoi :

| Jeton | Produit | Noyau | Pourquoi ce n'est pas corrigé ici |
|---|---|---|---|
| `--arrondi-bloc` | `12px` | `--rayon-bloc` = 20px | Choix documenté pour les blocs du produit (`jetons.css:144-148`). Le corriger changerait le rendu de onze modules — et D7d vient précisément de refuser de le faire |
| `--gold2` sombre | `#e2c07a` | `--accent-appuye` = `#cfb583` | Un accent ne se modifie pas sans le propriétaire |
| `--police-corps` | sans `'Segoe UI'` | avec | Sans effet : la famille vient **après** `sans-serif`, elle n'est jamais atteinte |
| `--police-titres` | sans `'Times New Roman'` | avec | Sans effet, même raison |

Les deux dernières sont des défauts du **noyau**, pas du produit : une famille
déclarée après un mot-clé générique ne peut jamais s'appliquer.

### Deux littéraux de couleur hors interface

| Fichier | Ce que c'est | Pourquoi ce n'est pas corrigé |
|---|---|---|
| `src/stores/config.ts:16` | la couleur d'accent par défaut du widget, `#c9a96e` / `#856b37` | Une valeur JavaScript ne peut pas lire une variable CSS au moment où le module s'évalue. Le SDK fournit déjà cette valeur par paramètre de requête ; ce défaut ne sert qu'au développement direct du widget, et le commentaire du fichier dit d'où viennent les deux valeurs |
| `public/demo.html` | 5 couleurs d'une page qui **simule un site hôte** | Elle n'embarque volontairement pas la feuille du design system, comme le ferait un site client : les valeurs sont recopiées avec leur source en commentaire. Hors du périmètre d'interface du harnais de 6.9 |

### La même collision de vocabulaire existe dans le widget

`src/components/ReglageNotifications.vue` nomme `.ep-notifs__carte` un bloc qui
porte `border-radius: var(--arrondi-bloc)` — 12 px. C'est **exactement** la
collision que D7d corrige, mais dans le widget, et D7d borne explicitement le
renommage à `admin.css`. Signalé, non corrigé : élargir un renommage au widget
en production sans que le propriétaire l'ait demandé dépasserait la décision.

À noter pour la suite : `.ep-voile__carte` (`VoileHorsLigne.vue`) porte le même
nom mais aucun rayon — ce n'en est pas un ; et `.ep-login__card`
(`LoginView.vue:99`) est une **vraie** carte à 28 px, correctement nommée.

### D7e — les 275 espacements littéraux

Non touchés, comme demandé. Ils relèvent d'une tâche à part après la phase 4.

---

## 8. Commits

| Commit | Sujet |
|---|---|
| `832a26b` | `refactor(console): D7d — le conteneur à 12 px devient un « bloc dense »` |
| `0c5cea7` | `fix(jetons): D7a — les voiles d'erreur composent --erreur` |
| `9cfdbde` | `fix(jetons): D7b — l'ombre d'accent compose le halo, et la console la reprend` |
| `ec9c50a` | `fix(console): D7c — l'état actif passe à la durée du design system` |
| `21d9c2f` | `fix(console): D4 — le filet du bouton secondaire passe au filet de contrôle` |
| `70b515c` | `docs(console): trois références de ligne décalées par les éditions elles-mêmes` |
| (celui-ci) | `docs(alignement): les harnais de preuve, les captures et ce rapport` |

Un commit par décision, et les justifications demandées — D7b et D7d — sont dans
le corps du message, pas seulement ici.

**Le commit `70b515c` mérite une explication, parce qu'il est le symptôme d'une
erreur réelle.** Les commentaires de D7a, D7b et D7c citent des lignes de leur
propre source ; ces éditions ont allongé les fichiers, donc décalé ce qu'elles
citent. Trois références pointaient à côté. Elles sont corrigées, et le commit
le dit plutôt que de réécrire l'historique — un historique qui cache ses
corrections vaut moins qu'un historique qui les montre. Aucune ligne de code
n'est concernée : le CSS compilé est identique à l'octet une fois la portée des
styles Vue neutralisée.
