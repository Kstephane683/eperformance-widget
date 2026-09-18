# Checklist de soumission — App Store Connect (iOS)

**Décision de la tâche 6.4 : rien n'est soumis en v1.** Ce document décrit ce
qui serait nécessaire, dans l'ordre, pour que le propriétaire puisse décider en
connaissance de cause — et pourquoi l'agent ne l'a pas fait.

Textes prêts : `DESCRIPTIONS.md` §2 · Visuels prêts : `app-store/` ·
Décision : `../DECISION-WRAPPER-NATIF.md`.

---

## 1. Pourquoi il n'y a rien à soumettre aujourd'hui

| Fait | Conséquence |
|---|---|
| Mia est une application web installable (PWA) | Sur iPhone, elle s'installe depuis Safari via « Sur l'écran d'accueil » — sans store, sans compte Apple (0 USD) |
| Apple refuse les habillages intégralement web (règle 4.2, « minimum functionality ») | Soumettre un emballage de la PWA serait un rejet quasi certain, et un rejet consomme du temps de revue |
| Le document maître situe le natif en **v2** (« quand le volume de leads le justifie », `ARCHITECTURE-CHATBOT-EPERFORMANCE-MASTER.md:1199-1200`) | La séquence est déjà arbitrée par le propriétaire : ne pas la devancer |
| Une compilation iOS exige Xcode, donc un Mac | L'environnement de production de ce dépôt est sous Linux : aucune compilation iOS n'est possible ici |
| Les notifications fonctionnent déjà sur iOS **installé** (iOS 16.4+, Web Push via APNs) | Le besoin fonctionnel de la v1 est couvert sans compte Apple |

## 2. Et si le propriétaire décide de soumettre la v2 native

### Étape 0 — Prérequis bloquants

| # | Action | Coût / contrainte |
|---|---|---|
| 0.1 | Compte Apple Developer Program | **99 USD par an**, reconduction annuelle — prérequis bloquant déclaré, assumé par le propriétaire |
| 0.2 | Accès à un Mac (ou à un runner macOS en CI) avec Xcode | Indispensable : CocoaPods, signature, archive, téléversement. Non disponible dans l'environnement actuel |
| 0.3 | Décider du socle natif | Capacitor (réutilise le web) ou natif complet — voir `../DECISION-WRAPPER-NATIF.md` §2 |
| 0.4 | Certificats et profils de provisionnement | Gérés par Xcode si le compte est actif ; à renouveler |

### Étape 1 — Application et fiche

| # | Action | Détail |
|---|---|---|
| 1.1 | Créer l'identifiant d'application (Bundle ID) | `pro.eperformance.mia` — **le même identifiant que le paquet Android** simplifie le suivi, mais les deux sont indépendants |
| 1.2 | Créer la fiche | Nom `Mia ePerformance` (16 caractères), sous-titre `L’assistante IA ePerformance` (28), catégorie Business, classification 4+ |
| 1.3 | Remplir la confidentialité | Reprendre le tableau App Store de `DESCRIPTIONS.md` §2 — cohérent avec la page cookies du site |
| 1.4 | URL d'assistance et politique de confidentialité | `https://eperformance.pro/` et `https://eperformance.pro/politique-confidentialite.html` |

### Étape 2 — Visuels (dossier `app-store/`)

| # | Fichier | Exigence Apple | État |
|---|---|---|---|
| 2.1 | `icone-1024.png` | 1024×1024, **sans transparence**, sans coins arrondis | Fourni (1024×1024, RGB) |
| 2.2 | `6-9-1320x2868-1-accueil.png` … `-4-actualites.png` | Jeu 6,9 pouces : **obligatoire** si aucun jeu 6,5 pouces n'est fourni. 1 à 10 captures | Fourni (4 captures, 1320×2868) |
| 2.3 | Jeu 6,5 pouces (1284×2778) | **Facultatif** : Apple réduit automatiquement le jeu 6,9 pouces | Non fourni — inutile |
| 2.4 | Jeu iPad 12,9 pouces (2048×2732) | Obligatoire **seulement** si l'application se déclare compatible iPad | À décider avec la v2 : si l'application est iPhone uniquement, ce jeu n'est pas demandé |

### Étape 3 — Revue et publication

| # | Action | Point de vigilance |
|---|---|---|
| 3.1 | Archive et téléversement | Xcode → Product → Archive → Distribute App |
| 3.2 | TestFlight avant revue | Une application conversationnelle se teste mal en captures : TestFlight évite un rejet pour fonctionnalité manquante |
| 3.3 | Répondre au questionnaire de revue | Apple demande souvent **ce qui distingue l'application du site** : c'est précisément la question qui coule un habillage web |
| 3.4 | Publication | Après approbation ; possibilité de publier par étapes |

---

## 3. Points de blocage connus

1. **Règle 4.2 (Minimum Functionality)** — c'est le premier motif de rejet d'une
   application qui se contente d'afficher un site. La v2 ne doit être soumise
   que lorsqu'elle apportera des fonctions embarquées (notifications riches,
   accès à l'appareil, mode hors ligne réel avec synchronisation).
2. **Le Mac est indispensable.** Aucun contournement : la compilation, la
   signature et le téléversement iOS passent par Xcode.
3. **99 USD/an, reconductible.** Si l'abonnement n'est pas renouvelé,
   l'application est retirée de la vente.
4. **Les captures ne pardonnent pas l'état d'erreur.** Une capture montrant un
   message d'indisponibilité est un motif de rejet : les visuels fournis ont été
   pris avec une réponse réelle (voir `RAPPORT-6-4-BLOC-B.md`, section des
   preuves).
5. **Cohérence de la rétention.** La fiche annonce 12 mois de conservation : cet
   engagement est celui de la page cookies, et la purge automatique existe
   (tâche 6.3-bis). Si la durée change côté site, la fiche doit être mise à jour
   dans les deux stores.
