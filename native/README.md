# Wrapper natif Android (TWA) — configuration et prérequis

**État : configuration posée, aucun binaire compilé, aucune publication.**
La publication appartient au propriétaire (voir la checklist Play Console).

Le fichier de configuration réel est **`/twa-manifest.json`**, à la racine du
dépôt — c'est l'emplacement que lit `bubblewrap`. La note de décision qui
justifie le choix Bubblewrap/TWA plutôt que Capacitor, et le Web Push standard
plutôt qu'OneSignal, est dans
`docs/phase3-tache-6-4/DECISION-WRAPPER-NATIF.md`.

---

## 1. Ce que fait un TWA (Trusted Web Activity)

L'application Android ne contient pas le code de Mia : elle ouvre la PWA
installée, dans un onglet Chrome plein écran, sans barre d'adresse — à
condition que le domaine prouve qu'il autorise cette application
(**Digital Asset Links**). C'est la voie que Google Play recommande pour une
application web déjà en ligne.

Conséquences directes, toutes favorables ici :

- une seule base de code : ce qui est publié sur le web est ce que voit
  l'utilisateur de l'application, sans repasser par une revue de store ;
- les notifications passent par le **Web Push** (FCM comme transport) ;
- le binaire à publier pèse quelques dizaines de kilo-octets.

---

## 2. Prérequis — trois actions du propriétaire, dans cet ordre

### a. Un sous-domaine dédié (bloquant)

Le domaine actuel de l'application est `kstephane683.github.io/eperformance-widget/`.
**Un TWA ne peut pas s'authentifier sur `github.io`** : la vérification exige de
publier `/.well-known/assetlinks.json` à la racine du domaine, et la racine de
`github.io` n'appartient pas à ePerformance.

1. Créer l'enregistrement DNS `CNAME mia.eperformance.pro → kstephane683.github.io`.
2. Dans le dépôt `eperformance-widget` (GitHub → Settings → Pages), renseigner
   « Custom domain » = `mia.eperformance.pro`, puis activer « Enforce HTTPS ».
   GitHub crée alors le fichier `CNAME` dans la branche `gh-pages`/`main` selon
   la configuration du dépôt — **ne pas le créer à la main dans `public/`** :
   tant que le DNS n'est pas en place, un `CNAME` déployé redirigerait
   l'application vers un domaine inexistant.
3. Vérifier que `https://mia.eperformance.pro/application/mia/` répond.

> Sans ce sous-domaine : `bubblewrap build` produit quand même un APK, mais il
> s'ouvre **avec la barre d'adresse** (TWA non vérifié). Ce n'est pas
> publiable en l'état sur Play — c'est un APK de test.

### b. La clé de signature et le fichier assetlinks.json

```bash
# 1. Créer le magasin de clés (mot de passe : à conserver hors dépôt)
keytool -genkey -v -keystore native/android.keystore -alias mia \
  -keyalg RSA -keysize 2048 -validity 10000

# 2. Calculer l'empreinte SHA-256 attendue par Digital Asset Links
keytool -list -v -keystore native/android.keystore -alias mia | grep SHA256

# 3. Publier l'empreinte : copier le modèle ci-dessous
cp docs/phase3-tache-6-4/assetlinks.json.modele public/.well-known/assetlinks.json
#    puis remplacer LE_SHA256_DE_LA_CLE dans le fichier
```

`public/.well-known/assetlinks.json` sera servi à
`https://mia.eperformance.pro/.well-known/assetlinks.json` après déploiement.
**Le fichier n'est volontairement pas créé ici** : il ne peut pas contenir autre
chose qu'un SHA-256 réel, et un fichier qui annonce une empreinte fausse fait
échouer la vérification en silence.

### c. Construire l'App Bundle et le publier

```bash
npm install -g @bubblewrap/cli        # outil officiel Google
bubblewrap build                      # lit twa-manifest.json à la racine
# → app-release-bundle.aab  (à téléverser sur Play Console)
# → app-release-signed.apk  (pour tester sur un appareil)
```

La publication elle-même (compte Play 25 USD, fiche, captures, formulaire de
sécurité des données) : `docs/phase3-tache-6-4/stores/CHECKLIST-PLAY.md`.

---

## 3. Ce qui n'est PAS dans ce dépôt, et pourquoi

| Élément | Raison |
|---|---|
| `android.keystore` | Secret de signature. Ignoré par git (`.gitignore`), à sauvegarder hors dépôt — sa perte oblige à publier une nouvelle application. |
| `app-release-bundle.aab` | Binaire compilé : la compilation et la publication appartiennent au propriétaire (consigne du Bloc B). |
| `public/.well-known/assetlinks.json` | Doit contenir une empreinte réelle, connue seulement après la création de la clé. |
| Projet Android généré | `bubblewrap build` le régénère à chaque fois depuis `twa-manifest.json` : le committer reviendrait à versionner un dossier généré. |

---

## 4. Vérifications à faire une fois le sous-domaine en place

```bash
# L'application est-elle déclarée ? (doit renvoyer une liste non vide)
curl -s https://mia.eperformance.pro/.well-known/assetlinks.json

# Le manifeste est-il servi avec le bon type ?
curl -sI https://mia.eperformance.pro/mia-manifest.webmanifest | grep -i content-type
# attendu : application/manifest+json

# Le service worker est-il servi à la racine du périmètre ?
curl -sI https://mia.eperformance.pro/sw.js | grep -i content-type
# attendu : text/javascript  (un type MIME incorrect empêche l'enregistrement)
```
