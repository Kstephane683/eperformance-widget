# Fiches de stores — textes prêts à coller

**Tâche 6.4, Bloc B.** Textes en français, **sans emoji** (règle n°8), sans
promesse de résultat ni superlatif : ce qui est décrit existe et a été livré.

Deux règles de rédaction appliquées aux deux stores :

- **aucun terme interne** : seul le prénom « Mia » est nommé, jamais un rôle
  d'agent, un modèle ou un élément d'architecture ;
- **aucune donnée personnelle annoncée** que la page cookies ne couvrirait pas
  (rétention 12 mois, suppression automatique).

---

## 1. Google Play

### Nom de l'application (30 caractères max)

```
Mia — assistante ePerformance
```

### Description courte (80 caractères max)

```
Posez votre question d’activité : Mia répond avec un angle et une étape.
```

Longueur : 72 caractères (limite : 80).

### Description complète (4000 caractères max)

```
Mia est l’assistante IA d’ePerformance. Elle répond aux questions qui bloquent
une activité — trouver des clients, gagner en visibilité, automatiser — avec un
angle concret, un exemple et la prochaine étape.

Ce n’est pas un formulaire, ni un catalogue à parcourir : vous écrivez votre
question en une phrase, la réponse arrive dans le fil, et vous enchaînez.

CE QUE MIA SAIT FAIRE

Développer mon activité
· Trouver plus de clients
· Développer mon MLM / parrainage
· Améliorer mes ventes

Visibilité et acquisition
· Créer un site web qui convertit
· Améliorer mon référencement
· Lancer une campagne publicitaire
· Gérer mes réseaux sociaux

Automatisation et IA
· Exploiter l’IA et l’automatisation
· Optimiser mon tunnel de conversion

COMMENT ÇA MARCHE

· Aucun compte à créer : vous ouvrez Mia et vous écrivez.
· Vos questions restent dans une même conversation, que vous pouvez reprendre.
· Mia répond seule ; quand le sujet demande une étude ou un accompagnement, un
  conseiller ePerformance prend le relais et signe ses messages de son nom.
· Clair ou sombre : Mia suit le thème de votre appareil.
· Sur téléphone comme sur ordinateur : la même application, à installer ou à
  utiliser dans le navigateur.

CONFIDENTIALITÉ

Les conversations sont conservées douze mois, puis supprimées automatiquement.
Le détail des données traitées est décrit dans la politique de confidentialité
d’ePerformance, accessible depuis l’application et depuis la fiche du store.

QUESTIONS FRÉQUENTES

Mia est-elle une personne ?
Non. Mia est une assistante IA. Elle s’appuie sur la base de connaissances et
les méthodes d’ePerformance.

Faut-il créer un compte ?
Non. Ni pour poser une question, ni pour lire la réponse.

L’application a-t-elle besoin d’une connexion ?
Oui pour répondre : Mia rédige ses réponses côté serveur. Hors ligne,
l’application affiche un écran d’attente et reprend dès que la connexion
revient.

Mia remplace-t-elle un conseiller ?
Non. Mia débloque une question précise ; l’accompagnement reste humain.

ePerformance — acquisition, IA et automatisation pour les PME et les
e-commerces.
```

### Catégorie et classification

| Champ Play Console | Valeur |
|---|---|
| Catégorie | Entreprise (Business) |
| Type | Application |
| Public visé | 18 ans et plus (aucun contenu sensible, mais outil professionnel) |
| Contenu | Aucun contenu généré par les utilisateurs visible par des tiers |
| Publicités | Non, aucune publicité dans l'application |
| Achats intégrés | Non |
| Sécurité des données | Voir la section 3 ci-dessous |

### Coordonnées de la fiche

| Champ | Valeur |
|---|---|
| Site web | `https://eperformance.pro/` |
| E-mail de contact | `bonjour@eperformance.pro` |
| Politique de confidentialité | `https://eperformance.pro/politique-confidentialite.html` |
| Page cookies / traceurs | `https://eperformance.pro/cookies.html` |

---

## 2. App Store (préparé pour la v2 native — rien à soumettre en v1)

> En v1, iOS utilise la PWA installée depuis Safari : aucun compte Apple n'est
> nécessaire (voir `../DECISION-WRAPPER-NATIF.md`). Ces textes sont prêts pour
> le jour où la v2 native sera décidée.

### Nom (30 caractères max)

```
Mia ePerformance
```

### Sous-titre (30 caractères max)

```
L’assistante IA ePerformance
```

Longueur : 28 caractères (limite : 30).

### Texte promotionnel (170 caractères max)

```
Posez votre question d’activité : Mia répond avec un angle concret, un exemple
et la prochaine étape. Neuf domaines couverts, aucun compte à créer.
```

### Mots-clés (100 caractères max, séparés par des virgules, sans espace)

```
assistante,IA,chatbot,acquisition,clients,visibilite,SEO,automatisation,conseil,PME
```

### Description

Reprendre la description complète de Google Play (section 1), sans modification :
elle ne contient aucune référence à Android ni à un magasin.

### Classification et confidentialité

| Champ App Store Connect | Valeur |
|---|---|
| Catégorie principale | Business |
| Classification d'âge | 4+ (aucun contenu sensible) |
| Suivi publicitaire | Non |
| Données liées à l'utilisateur | Contenu des messages (conversation), identifiant de conversation — utilisés pour répondre et améliorer le service, non revendus |
| Politique de confidentialité | `https://eperformance.pro/politique-confidentialite.html` |
| URL d'assistance | `https://eperformance.pro/` |

---

## 3. Formulaire « Sécurité des données » (Play) — réponses exactes

Réponses à donner telles quelles : elles correspondent au code livré, aux
routes du backend et à la page cookies du site.

| Question Play Console | Réponse | Pourquoi |
|---|---|---|
| L'application collecte-t-elle ou partage-t-elle des données ? | **Oui, collecte** (aucun partage) | La conversation est envoyée au backend pour être traitée |
| Les données sont-elles chiffrées en transit ? | **Oui** | HTTPS de bout en bout (GitHub Pages, Railway) |
| L'utilisateur peut-il demander la suppression ? | **Oui** | Par la page cookies / la politique de confidentialité (contact e-mail) |
| Données collectées : messages | **Facultatif** — « Fonctionnalité de l'application » | Le message est nécessaire pour répondre |
| Données collectées : identifiant de conversation | **Oui** — « Fonctionnalité de l'application » | Permet de reprendre une conversation |
| Données collectées : journaux de plantage / diagnostics | **Non** | Aucun outil de ce type n'est embarqué |
| Données collectées : position, contacts, photos | **Non** | Aucune permission demandée, aucun accès |
| Données collectées : identifiants publicitaires | **Non** | Aucun SDK publicitaire |
| Transfert vers des tiers | **Non** | Le seul destinataire est le backend d'ePerformance (Railway) |
| Rétention | 12 mois puis suppression automatique | Purge quotidienne livrée (tâche 6.3-bis) et décrite dans la page cookies |
