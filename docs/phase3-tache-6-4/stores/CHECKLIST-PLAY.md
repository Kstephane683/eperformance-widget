# Checklist de soumission — Google Play Console

**À faire par le propriétaire.** Rien de cette liste n'a été fait par l'agent :
aucun compte créé, aucun binaire compilé, aucune publication (consigne du
Bloc B). Les étapes sont dans l'ordre d'exécution ; les points de blocage
connus sont signalés par **BLOCAGE**.

Textes prêts à coller : `DESCRIPTIONS.md` · Visuels prêts : `play/` ·
Décision technique : `../DECISION-WRAPPER-NATIF.md`.

---

## Étape 0 — Prérequis bloquants (à faire AVANT tout le reste)

| # | Action | Pourquoi | Coût |
|---|---|---|---|
| 0.1 | **BLOCAGE** — Réserver `mia.eperformance.pro` (enregistrement DNS `CNAME` vers `kstephane683.github.io`), puis déclarer ce domaine dans GitHub → Settings → Pages → Custom domain | Sans domaine maîtrisé, impossible de publier `/.well-known/assetlinks.json` : le TWA s'ouvrirait avec la barre d'adresse et serait refusé en revue | 0 |
| 0.2 | **BLOCAGE** — Créer la clé de signature et la sauvegarder hors du dépôt : `keytool -genkey -v -keystore native/android.keystore -alias mia -keyalg RSA -keysize 2048 -validity 10000` | Sa perte oblige à publier une **nouvelle** application (changement d'empreinte) | 0 |
| 0.3 | Publier l'empreinte : `keytool -list -v -keystore native/android.keystore -alias mia \| grep SHA256`, puis copier `docs/phase3-tache-6-4/assetlinks.json.modele` en `public/.well-known/assetlinks.json` et remplacer `LE_SHA256_DE_LA_CLE` | C'est ce fichier qui autorise l'application à s'afficher sans barre d'adresse | 0 |
| 0.4 | Vérifier `https://mia.eperformance.pro/.well-known/assetlinks.json` renvoie bien le JSON publié | Une empreinte fausse échoue **en silence** (l'application s'ouvre avec la barre d'adresse, sans message d'erreur) | 0 |

## Étape 1 — Compte et application

| # | Action | Détail |
|---|---|---|
| 1.1 | Créer un compte Google Play Console | **25 USD une fois**, pièce d'identité demandée depuis 2023 (vérification du compte développeur) |
| 1.2 | Créer l'application | Nom : `Mia — assistante ePerformance` · Langue par défaut : français (France) · Type : Application · Gratuite |
| 1.3 | Renseigner la fiche | Utiliser `DESCRIPTIONS.md` (nom, description courte 72 caractères, description complète 2106 caractères) |

## Étape 2 — Visuels (dossier `play/`)

| # | Fichier | Exigence Play | État |
|---|---|---|---|
| 2.1 | `icone-512.png` | 512×512 PNG 32 bits, ≤ 1 Mo | Fourni (512×512, 24 bits sans alpha — accepté) |
| 2.2 | `graphique-1024x500.png` | 1024×500, sans alpha, sans texte promotionnel | Fourni |
| 2.3 | `telephone-1080x1920-1-accueil.png` … `-4-actualites.png` | 2 à 8 captures téléphone, 320–3840 px, sans alpha, 9:16 | Fourni (4 captures, 1080×1920) |
| 2.4 | `tablette-7-1200x1920-*.png` | Optionnel mais recommandé (mise en avant sur tablette) | Fourni (4 captures, 1200×1920) |
| 2.5 | `tablette-10-1600x2560-*.png` | Idem, 10 pouces | Fourni (4 captures, 1600×2560) |

> Les 4 premières captures téléphone suffisent à la publication. Les captures
> tablette augmentent la visibilité : Play les affiche par type d'appareil.

## Étape 3 — Contenu de la fiche

| # | Formulaire | Réponse |
|---|---|---|
| 3.1 | Catégorie | Entreprise |
| 3.2 | Sécurité des données | Reprendre le tableau de `DESCRIPTIONS.md` §3 **tel quel** |
| 3.3 | Classification du contenu | Questionnaire « Application » ; aucun contenu sensible → classement 3+ |
| 3.4 | Public visé | 18 ans et plus (outil professionnel) |
| 3.5 | Publicités | Non |
| 3.6 | Accès à l'application | « Toutes les fonctionnalités sont disponibles sans identifiant » — l'application ne demande aucun compte |
| 3.7 | Politique de confidentialité | `https://eperformance.pro/politique-confidentialite.html` |

## Étape 4 — Compilation et téléversement (à faire depuis cette machine)

```bash
npm install -g @bubblewrap/cli
cd /home/ballo/OX6A/toolkit_eperformance/eperformance-widget
bubblewrap build            # lit twa-manifest.json à la racine
```

Produit `app-release-bundle.aab` (à téléverser) et `app-release-signed.apk`
(pour tester sur un appareil **avant** de soumettre).

| # | Action | Vérification |
|---|---|---|
| 4.1 | Installer l'APK de test sur un appareil Android | L'application s'ouvre **sans barre d'adresse** (donc : assetlinks en place) |
| 4.2 | Vérifier la connexion | Ouvrir Mia, poser une question, obtenir une réponse |
| 4.3 | Vérifier l'affichage | Le thème suit l'appareil (clair/sombre) |
| 4.4 | Téléverser l'App Bundle | Play Console → Production → Créer une version |
| 4.5 | Soumettre | Revue Play : de quelques heures à quelques jours |

## Étape 5 — Après publication

| # | Action | Pourquoi |
|---|---|---|
| 5.1 | Ajouter le lien Play sur `eperformance.pro` | Relève du **SITE** — à demander dans le journal de coordination |
| 5.2 | Mettre à jour `twa-manifest.json` si le domaine change | Un TWA pointe sur une URL : le changer côté fiche n'est pas possible |
| 5.3 | Suivre la fiche « Signaler » de Play | Une application TWA cassée (manifeste renommé) est vite signalée |

---

## Points de blocage connus — à lire avant de commencer

1. **Le domaine est le seul vrai obstacle.** Tant que `mia.eperformance.pro`
   n'est pas en place, l'étape 4.1 échoue : l'application s'ouvre comme un
   navigateur, ce que Play refuse en production.
2. **Une empreinte SHA-256 se vérifie en 30 secondes** mais casse en silence :
   si l'APK de test montre une barre d'adresse, c'est presque toujours
   `assetlinks.json` (empreinte, chemin, ou type MIME).
3. **La clé de signature ne se régénère pas.** Sauvegarde hors dépôt, plus une
   copie du mot de passe.
4. **Le compte Play demande une vérification d'identité** (adresse, pièce
   d'identité) : prévoir 24-48 h avant d'espérer publier.
5. **Ne pas cocher « Application gratuite avec Achats intégrés »** : Mia n'a
   aucun achat, et une case cochée à tort bloque la revue.
