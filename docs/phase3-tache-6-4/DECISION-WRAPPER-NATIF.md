# Décision — wrapper natif et notifications push

**Tâche 6.4, Bloc B.** Note de décision, pas un comparatif générique : elle
répond aux contraintes réelles de ce projet, telles qu'elles existent au
18 septembre 2026.

> **Ce qui est décidé ici n'est pas publié.** Aucun binaire n'est compilé, aucun
> compte n'est créé. La publication appartient au propriétaire (compte Google
> Play 25 USD une fois, compte Apple 99 USD/an) — prérequis bloquant qu'il
> assume, et qui est rappelé en tête des deux checklists.

---

## 1. Contraintes réelles du projet

| # | Contrainte | Valeur constatée |
|---|---|---|
| C1 | La PWA existe déjà et est en production | `kstephane683.github.io/eperformance-widget/` — `mia-manifest.webmanifest`, service worker, installable (tâche 6.4) |
| C2 | Le contenu est majoritairement conversationnel | Les réponses viennent du backend (Railway) : le contenu change **sans** que l'application change |
| C3 | Les notifications push arrivent côté backend | Tâche 6.5 planifiée ; le document maître annonce FCM/APNs |
| C4 | Un seul mainteneur, et sa machine est sous **Linux** | Pas de Mac, donc pas de Xcode : une compilation iOS est impossible ici |
| C5 | Budget | 25 USD (Play, une fois) + 99 USD/an (Apple). Le reste doit rester gratuit |
| C6 | Les mises à jour doivent ne rien coûter | Chaque revue de store est un délai ; l'interface évolue vite (tâches 6.3 et 6.4) |
| C7 | Le document maître situe déjà les priorités | « PWA responsive — v1, même codebase » · « App native Flutter/React Native — **v2**, quand le volume de leads le justifie » (`ARCHITECTURE-CHATBOT-EPERFORMANCE-MASTER.md:1199-1200`) |

**C4 et C7 sont décisives** : elles écartent d'emblée tout ce qui exige une
chaîne de compilation Apple, et elles fixent la règle — la v1 est la PWA, le
natif viendra quand il se justifiera.

---

## 2. Décision

| Volet | Décision | Justification en une phrase |
|---|---|---|
| **Android** | **Bubblewrap / TWA** — configuration posée dans `twa-manifest.json` | La PWA est déjà en ligne, le TWA n'en est qu'un habillage vérifié par Digital Asset Links : une seule base de code, mise à jour continue sans revue de store (C2, C6), et c'est la voie que Google Play recommande pour une application web existante. |
| **iOS** | **Aucun wrapper en v1** — PWA installée depuis Safari (`Sur l'écran d'accueil`) | Un habillage intégral du web est refusé au titre de la règle 4.2 (« minimum functionality ») d'Apple, et le construire exigerait un Mac + 99 USD/an pour un doublon du web (C4, C5) — le natif iOS est renvoyé à la v2, comme le document maître le prévoit (C7). |
| **Notifications** | **Web Push standard (VAPID)**, transporté par **FCM** sur Chrome/Android et **APNs** sur iOS installé | Aucun SDK tiers embarqué, aucun coût, aucune donnée confiée à un prestataire de plus : le service worker livre déjà la fonction `push`, et le backend n'aura qu'à signer ses envois avec sa clé VAPID (tâche 6.5, périmètre BACKEND). |

### Capacitor — écarté, et à quelle condition il reviendrait

Capacitor n'est pas mauvais : c'est le bon outil quand l'application a besoin
de **fonctions natives** (appareil photo, fichiers, Bluetooth, fond de tâche).
Ici, aucune de ces fonctions n'est demandée, et il coûte trois choses que le
projet ne peut pas payer aujourd'hui :

1. **une compilation par plateforme** — Android SDK *et* Xcode : la seconde est
   hors de portée sur cette machine (C4) ;
2. **une revue de store pour chaque évolution d'interface** — l'interface a
   changé trois fois en une semaine (tâches 6.2-bis, 6.3-bis, 6.4) alors que le
   contenu, lui, ne dépend pas du binaire (C2, C6) ;
3. **un projet natif à maintenir** — deux dossiers générés, des plugins à
   suivre, pour un seul mainteneur.

Il redeviendra le bon choix le jour où Mia aura besoin du matériel de
l'appareil (scan de documents, notifications riches, mode hors ligne avec
synchronisation en arrière-plan). Ce jour-là, la configuration à écrire sera
`capacitor.config.ts` + `@capacitor/*` dans `package.json` — **rien n'est posé
aujourd'hui**, volontairement : ajouter ces dépendances sans les compiler
casserait `npm ci` en intégration continue (le verrou de dépendances ne les
connaît pas).

### OneSignal — écarté, et pourquoi le Web Push standard suffit

| Critère | Web Push standard (retenu) | OneSignal |
|---|---|---|
| Coût | 0 | Gratuit jusqu'à un plafond d'abonnés, puis payant |
| Dépendance | Aucune : `PushManager` + VAPID, déjà dans le navigateur | SDK JavaScript tiers chargé sur les pages |
| Données | Le backend parle directement au transport (FCM/APNs) | Un prestataire supplémentaire traite l'identifiant d'abonné et les métadonnées |
| Conformité | Rien à déclarer de plus | À déclarer dans la page cookies et la politique de confidentialité — **fichiers du SITE**, donc coordination supplémentaire |
| Tableau de bord | À construire côté backend (compteurs, journal d'envoi) | Prêt à l'emploi |
| Correspondance avec le document maître | FCM/APNs annoncés (C3, C7) | Hors du plan |

La seule chose qu'OneSignal apporte réellement ici est le tableau de bord. Le
backend de Mia journalise déjà ses envois (tâche 6.5) : ce n'est pas un motif
suffisant pour introduire un tiers et rouvrir une page de conformité.

---

## 3. Ce qui est posé dans le dépôt

| Fichier | Nature |
|---|---|
| `twa-manifest.json` | Configuration réelle lue par `bubblewrap` (paquet `pro.eperformance.mia`, domaine `mia.eperformance.pro`, couleurs canoniques, notifications activées, trois raccourcis). |
| `native/README.md` | Les trois actions du propriétaire, dans l'ordre, avec les commandes exactes. |
| `docs/phase3-tache-6-4/assetlinks.json.modele` | Modèle du fichier de vérification Digital Asset Links — **volontairement non déployé** : il doit porter une empreinte SHA-256 réelle. |
| `.gitignore` | Clés (`*.keystore`, `*.jks`), projet Android généré, binaires : jamais versionnés. |

## 4. Ce qui reste au propriétaire

1. Réserver `mia.eperformance.pro` (DNS + domaine personnalisé GitHub Pages) —
   **bloquant** pour un TWA vérifié.
2. Créer et sauvegarder la clé de signature, publier l'empreinte dans
   `public/.well-known/assetlinks.json`.
3. Créer le compte Google Play (25 USD), compiler (`bubblewrap build`) et
   publier — voir `stores/CHECKLIST-PLAY.md`.
4. Pour iOS : rien à soumettre en v1. La distribution se fait par Safari
   (« Sur l'écran d'accueil »), ce que la page `/application/mia` explique déjà
   à l'utilisateur. Le compte Apple (99 USD/an) ne devient nécessaire qu'en v2,
   avec une application native qui apporte de vraies fonctions embarquées.
