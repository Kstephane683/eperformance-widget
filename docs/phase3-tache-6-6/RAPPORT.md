# Tâche 6.6 — Maquettes finales de référence

**Date :** 18 septembre 2026 · **Périmètre :** dépôt `eperformance-widget`
uniquement. **Hors périmètre, non touché :** `unified-ia-backend/**`,
`docker-unified/**`, `site-eperformance/**`, `blog-eperformance/**`,
`agent-ia-web/**`, `eperformance-widget/src/sdk/**` (gelé par contrat).

| Livrable | État | Preuve |
|---|---|---|
| 1. Maquettes de **tous** les écrans, clair **et** sombre, mobile **et** desktop | ✅ | **112 images** dans `docs/phase3-tache-6-6/maquettes/` |
| 2. Échelle 2 (exigence : facteur 2 minimum) | ✅ | `maquettes.index.json` → `"echelle": 2` sur les 112 entrées |
| 3. Nomenclature `<ecran>-<gabarit>-<theme>.png` | ✅ | `maquettes.config.json` → `nomenclature` |
| 4. Fichiers sources : harnais + configuration versionnés | ✅ | `captures.py` (script) + `maquettes.config.json` + `jeux-essai.json` |
| 5. Index de la tâche | ✅ | ce document + `maquettes.index.json` (une entrée par image) |
| 6. Planche de synthèse (facultative) | ✅ | 4 planches, une par série |
| 7. Rendu obtenu de l'application **réellement exécutée** | ✅ | build `dist/` servi tel quel ; API interceptée ; widget ouvert par le SDK dans une page hôte |
| 8. Aucun emoji, aucun nom d'agent interne dans les images | ✅ | **0 fuite** sur 112 captures (analyse du texte rendu à chaque prise) |

---

## 1. Ce qui a été capturé

| Série | Écrans | Images | Ce que la série montre |
|---|---|---|---|
| `widget-*` | 5 vues + 2 états de contexte | **26** | Le widget **dans la page d'un site hôte**, ouvert par le SDK : panneau de 400 px en desktop, plein écran en mobile |
| `console-*` | 11 modules + 2 états | **50** | Les 11 modules du registre, plus la conversation ouverte et le tiroir mobile |
| `application-*` | 5 vues | **20** | Les mêmes cinq vues en **mode application** (colonne de 760 px, document de premier niveau) — ce que voit l'utilisateur de la PWA installée |
| `pages-*` | 2 pages × 2 sections | **16** | `/application` (portail) et `/application/mia` (page de présentation), haut et bas de page |

**112 images**, réparties également : **56 clair / 56 sombre** et
**56 mobile / 56 desktop**. Chaque image existe donc dans les quatre
combinaisons, sauf deux états qui n'ont de sens qu'à une taille — c'est dit
et justifié plus bas (§4).

### Les 23 écrans

| Contexte | Écrans |
|---|---|
| **Widget visiteur** | Accueil, Messages, Aide, Actualités, Conversation |
| **Console d'administration** | Tableau de bord, Activité, Performance, Boîte de réception, Prospects, Candidatures, Base de connaissances, Publications, Compétences de Mia, Utilisateurs, Intégrations |
| **Application Mia** | Accueil, Messages, Aide, Actualités, Conversation |
| **Pages publiques** | Portail `/application`, page `/application/mia` |

23 écrans × 2 gabarits × 2 thèmes = **92** images ; les 20 restantes sont les
sections de bas de page (4), les états de contexte du widget (6) et les deux
états qui n'existent qu'à une taille (2), plus les doublons légitimes entre
séries (widget et application partagent les mêmes cinq vues dans deux modes).

### Chemins

Toutes les maquettes sont dans
`/home/ballo/OX6A/toolkit_eperformance/eperformance-widget/docs/phase3-tache-6-6/maquettes/`.

Exemples directs :

- `widget-conversation-desktop-1440x900-sombre.png` — fil repris du serveur, widget dans son panneau
- `widget-en-contexte-ouvert-desktop-1440x900-clair.png` — la page du site hôte entière, widget ouvert
- `console-tableau-de-bord-desktop-1440x900-clair.png` — les 5 indicateurs et les 3 files « à traiter »
- `console-boite-de-reception-mobile-390x844-sombre.png` — la boîte de réception à 390 px
- `application-accueil-mobile-390x844-clair.png` — l'application Mia, mode document
- `pages-mia-haut-desktop-1440x900-clair.png` — la page de présentation publique
- `planche-01-widget.png` … `planche-04-pages.png` — les quatre planches de synthèse

L'index complet, une entrée par image (fichier, MD5, octets, dimensions,
gabarit, thème, série, écran, nombre d'appels d'API interceptés, termes
internes présents) :
`docs/phase3-tache-6-6/maquettes.index.json`.

---

## 2. Méthode — comment les images sont obtenues

Le harnais **ne reconstitue rien** : il sert le build publié et pilote un vrai
navigateur (Chromium 151, Playwright).

| Point | Décision | Pourquoi |
|---|---|---|
| Source des images | `dist/` servi tel quel par un serveur statique local | C'est le même artefact que celui publié sur GitHub Pages. Une maquette d'un build intermédiaire ne serait pas le produit |
| Widget visiteur | Page d'un **site hôte réel** (`docs/phase3-tache-6-4/hote-6-4.html`, harnais de la tâche 6.4), SDK chargé, bulle **cliquée** | Le widget n'existe pas seul : il vit dans une iframe, à 400 px, sur le site. Le capturer hors de ce contexte ne montrerait pas le produit |
| Navigation entre écrans | **Clic sur l'onglet réel** quand l'onglet existe | Un visiteur clique un onglet ; le harnais fait le même geste plutôt que de forcer une route |
| Console | API **interceptée** (`jeux-essai.json`, reprise des jeux d'essai de la tâche 6.3) | Les images sont reproductibles à l'octet, sans compte ni réseau. Les jeux d'essai portent **volontairement** les clés d'agent interne : c'est ce que la console ne doit jamais afficher, et la mesure porte sur le document rendu, pas sur le code |
| Échelle | `device_scale_factor = 2` | Exigence de la consigne |
| Thèmes | `color_scheme` forcé par contexte **et** `?theme=` sur le document | Le clair et le sombre sont tous deux déterministes, indépendamment des préférences de la machine de mesure |
| Planches | Recomposées depuis les maquettes **déjà écrites** | Aucune capture supplémentaire : la planche ne peut pas diverger des maquettes |

### Les trois contrôles qui empêchent une maquette fausse

Un harnais de capture qui écrit 112 images sans rien vérifier produit
112 images, dont on ne sait rien. Trois contrôles sont donc exécutés **à chaque
prise**, et un échec interrompt la série :

1. **Le texte attendu doit apparaître.** Chaque écran déclare un fragment
   (`attendu` dans la configuration) qui prouve que les données sont arrivées
   jusqu'au rendu — « Awa Traoré » sur le tableau de bord, « paniers
   abandonnés » dans le fil de conversation. Un écran sans données n'est pas
   une maquette : c'est un écran vide, et le harnais le refuse.
2. **Au moins un appel d'API doit avoir été intercepté** sur les écrans de la
   console. Sans données, le tableau de bord afficherait des zéros et la boîte
   de réception une liste vide, en silence.
3. **Les termes internes sont recherchés dans le texte rendu** de chaque
   écran. Résultat : **0 fuite sur 112 images**, alors que les jeux d'essai en
   portent six (`sales-coach`, `closer-pro`, `seo-expert` et leurs libellés).

---

## 3. Défauts trouvés par le harnais, et corrigés

| Défaut | Ce qui s'est passé | Ce qui l'a rendu visible |
|---|---|---|
| **Motif d'interception d'API faux** | `page.route('…railway.app/*')` : dans un motif glob de Playwright, `*` **ne franchit pas** le `/`. La route n'était jamais interceptée, la requête partait sur le réseau réel et échouait en CORS. Le tableau de bord se capturait **avec des zéros** | Le compteur d'appels interceptés, ajouté au harnais : 0 appel = échec |
| **Conversation vide crue pleine** | Réutiliser une page pour les cinq vues du widget faisait bloquer la reprise de conversation pendant la capture de l'écran précédent (2880×1800 en échelle 2) ; la copie de l'application annulait la requête (`net::ERR_FAILED`) et le fil retombait sur le message d'accueil | Le contrôle « texte attendu » : la série s'est arrêtée au lieu d'écrire 25 images fausses |
| **Widget pointé sur le mauvais serveur** | Le paramètre `api` du harnais désignait le serveur local, qui répond 404 sur `/api/…` : la reprise de conversation échouait silencieusement | Idem — même contrôle |
| **Entrées fantômes dans l'index** | L'index conservait les entrées d'une exécution précédente dont les fichiers avaient été supprimés (96 entrées pour 76 fichiers) | Contrôle de cohérence index ↔ disque, et dédoublonnage par nom de fichier |

Ces quatre défauts n'ont **pas** produit d'image : ils ont arrêté le harnais.
C'est le résultat attendu d'un contrôle placé avant l'écriture du fichier.

---

## 4. Ce qui n'a pas été capturé, et pourquoi

| Élément | Pourquoi | Ce qu'il faudrait |
|---|---|---|
| **Écran de connexion de la console** | Hors des 11 modules : le harnais de la tâche 6.3 le capture déjà (`apres-connexion-*`), et il n'a pas changé depuis | Rien — couvert par la tâche 6.3 |
| **`en-contexte-ouvert` en mobile** | En mobile le panneau du widget **couvre la page entière** (390 px) : l'image serait identique à celle du panneau, octet pour octet. Une image en double n'est pas une maquette de plus | Rien — l'état est déjà montré par `widget-accueil-mobile-*` |
| **`menu-mobile` en desktop** | Le tiroir mobile n'existe qu'en mobile (≤ 1000 px) : le bouton n'est pas affiché en desktop, le clic échouerait | Rien — l'état n'existe pas à cette taille |
| **Écrans de chargement / erreur / hors-ligne** | La tâche 6.4 a livré l'écran hors-ligne et l'invite d'installation avec leurs captures ; les états de chargement durent moins d'une seconde et ne se photographient pas de façon stable | Une série d'états si le propriétaire veut une référence des transitions |
| **Écran « conversation avec une vraie réponse de Mia »** | Une réponse du modèle n'est pas reproductible : elle n'a pas sa place dans des maquettes de référence, qui doivent se régénérer à l'identique | `python3 captures.py conversation-reelle` produit cette série à part, dans `maquettes/conversation-reelle/` (voir §6) |
| **Les 27 agents internes** | Règle produit : seul « Mia » est visible. Aucune maquette ne les nomme ni ne les compte — c'est vérifié, pas supposé | Rien |

---

## 5. Régénérer les maquettes

```bash
cd /home/ballo/OX6A/toolkit_eperformance/eperformance-widget
npm run build                          # le build que les maquettes servent
python3 docs/phase3-tache-6-6/captures.py            # les 4 séries + index + planches
python3 docs/phase3-tache-6-6/captures.py widget     # une série seulement
python3 docs/phase3-tache-6-6/captures.py index      # index et planches seuls
```

Une maquette qu'on ne peut pas régénérer est une image morte : **rien dans le
script ne décrit un écran**. Modifier la liste des écrans, un gabarit, un thème
ou un sélecteur se fait dans `maquettes.config.json`, jamais dans le code.
Ajouter un écran à une série suffit à le voir apparaître dans l'index et dans
la planche.

Aucun fichier n'est écrit hors de `docs/phase3-tache-6-6/`.

---

## 6. Série complémentaire — conversation réelle (hors maquettes)

`python3 docs/phase3-tache-6-6/captures.py conversation-reelle` relaie les
appels vers l'**API de production** : Mia répond réellement, seule la
transportée est locale (le backend n'autorise pas l'origine `127.0.0.1`).
Dix questions sont posées par gabarit et par thème.

Cette série **n'entre pas dans les 112 maquettes** : elle dépend du modèle,
donc elle n'est pas reproductible à l'octet, et une maquette de référence doit
l'être. Elle sert de preuve de bout en bout et de base à la mesure des emoji de
la tâche 6.9 — mesurer une réponse simulée ne prouverait rien sur ce que Mia
écrit réellement. Les images sont dans `maquettes/conversation-reelle/`.

---

## 7. Point d'attention relevé pendant la capture

**L'en-tête du widget affiche « Mia — Agent IA · en ligne ».** Ce n'est pas une
fuite d'agent : « Agent IA » est le **rôle** de Mia, pas une clé de routage
interne, et le seul nom affiché reste « Mia ». Les trois pastilles d'équipe du
widget portent leurs libellés en attribut `title` (« Mia — agent IA
ePerformance », « K. Stéphane — fondateur ePerformance », « L'équipe
ePerformance ») : ce sont des personnes de la marque, pas les agents internes
du backend. Signalé pour transparence, **non modifié** : cela relève d'une
décision de contenu, pas d'un défaut de capture. Aucune des 112 maquettes ne
porte de terme d'agent interne (0 sur 112, mesuré).

---

## 8. Commits

| Commit | Sujet |
|---|---|
| `docs(6.6)` | harnais de maquettes finales, configuration, 112 captures et index |
