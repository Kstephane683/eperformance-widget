/* ==========================================================================
   Service worker de l'application Mia (tâche 6.4)

   Rôle : rendre l'application Mia installable et utilisable pendant une
   coupure réseau — SANS jamais servir une réponse périmée de Mia.

   ── Stratégie, par nature de requête ─────────────────────────────────────

   1. RÉSEAU D'ABORD pour les navigations (documents HTML) : on veut la
      dernière version de la page ; le cache ne sert qu'en secours, hors ligne.
   2. CACHE D'ABORD pour les ressources statiques (polices, icônes, images,
      scripts et feuilles fingerprintés par le build) : elles ne changent pas,
      et les resservir depuis le cache est ce qui rend l'ouverture instantanée.
   3. AUCUNE INTERCEPTION — donc réseau pur, sans copie locale — pour :
        · tout ce qui n'est pas de même origine (l'API Mia est sur
          https://web-production-4ab53.up.railway.app : ses réponses sont
          personnalisées et datées, elles ne doivent JAMAIS être servies
          périmées — c'est la règle du propriétaire pour le réseau d'abord) ;
        · les chemins `/api/…` servis sur notre propre origine ;
        · la console d'administration (`admin.html`) : ses données sont
          authentifiées, elles ne sont pas mises en cache ;
        · toute méthode autre que GET (POST /message, PUT, DELETE…).

   ── Cycle de vie ─────────────────────────────────────────────────────────
   Une seule version vit à la fois : à l'activation, tous les caches qui ne
   portent pas le préfixe VERSION sont supprimés. Pour publier une nouvelle
   version de la coquille, incrémenter VERSION — c'est la seule chose à faire.

   Volontairement sans dépendance et sans étape de compilation : ce fichier
   est copié tel quel depuis public/ vers dist/.
   ========================================================================== */

/* Incrémenter à chaque publication qui change la coquille (HTML, icônes,
   manifeste). Le nom porte la version : l'activation purge le reste. */
const VERSION = 'mia-v1'

const CACHE_COQUILLE = `${VERSION}-coquille`
const CACHE_STATIQUE = `${VERSION}-statique`

/* Coquille : de quoi ouvrir l'application hors ligne. Chemins relatifs à la
   portée du service worker — l'application peut être servie sous n'importe
   quel chemin (/eperformance-widget/, un sous-domaine, la racine). */
const COQUILLE = [
  './index.html',
  './mia-manifest.webmanifest',
  './favicon.svg',
  './icons/mia-192.png',
  './icons/mia-512.png',
]

/* Types de ressources servis depuis le cache (cache d'abord) */
const TYPES_STATIQUES = ['font', 'image', 'style', 'script', 'manifest']

/* Chemin de l'URL, sans la portée : sert aux exclusions */
function chemin(requete) {
  return new URL(requete.url).pathname
}

function estAdministration(requete) {
  return chemin(requete).includes('/admin')
}

function estApiLocale(requete) {
  const p = chemin(requete)
  return p.includes('/api/') || p.includes('/api')
}

/* --------------------------------------------------------------------------
   Installation : pré-cache de la coquille.
   Chaque fichier est ajouté individuellement : un seul 404 ne doit pas faire
   échouer l'installation entière (c'est le piège classique de `addAll`).
   -------------------------------------------------------------------------- */
self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches
      .open(CACHE_COQUILLE)
      .then((cache) => Promise.all(COQUILLE.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting()),
  )
})

/* --------------------------------------------------------------------------
   Activation : purge des caches des versions précédentes, puis prise de
   contrôle des pages déjà ouvertes.
   -------------------------------------------------------------------------- */
self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((noms) =>
        Promise.all(
          noms.filter((nom) => !nom.startsWith(VERSION)).map((nom) => caches.delete(nom)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

/* --------------------------------------------------------------------------
   Navigations : réseau d'abord, cache en secours.
   `ignoreSearch` couvre les paramètres du SDK (apiUrl, siteId, theme…) : hors
   ligne, la coquille pré-cachée répond quel que soit le paramétrage d'entrée.
   -------------------------------------------------------------------------- */
async function repondreNavigation(requete) {
  const cache = await caches.open(CACHE_COQUILLE)
  try {
    const reponse = await fetch(requete)
    if (reponse && reponse.ok) {
      cache.put(requete, reponse.clone()).catch(() => null)
    }
    return reponse
  } catch {
    const enCache = (await cache.match(requete, { ignoreSearch: true })) || (await cache.match('./index.html'))
    if (enCache) return enCache
    return new Response(PAGE_HORS_LIGNE, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}

/* --------------------------------------------------------------------------
   Ressources statiques : cache d'abord, réseau en remplissage.
   -------------------------------------------------------------------------- */
async function repondreStatique(requete) {
  const cache = await caches.open(CACHE_STATIQUE)
  const enCache = await cache.match(requete)
  if (enCache) return enCache
  const reponse = await fetch(requete)
  if (reponse && reponse.ok) {
    cache.put(requete, reponse.clone()).catch(() => null)
  }
  return reponse
}

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request

  // 1. Jamais de cache pour autre chose qu'un GET
  if (requete.method !== 'GET') return

  // 2. Jamais de cache hors de notre origine : l'API de Mia passe par le
  //    réseau, toujours. Le navigateur fait son travail normalement.
  let origine
  try {
    origine = new URL(requete.url).origin
  } catch {
    return
  }
  if (origine !== self.location.origin) return

  // 3. Console d'administration et API locale : hors du cache, sans exception
  if (estAdministration(requete) || estApiLocale(requete)) return

  // 4. Navigations : réseau d'abord
  if (requete.mode === 'navigate') {
    evenement.respondWith(repondreNavigation(requete))
    return
  }

  // 5. Ressources statiques : cache d'abord
  if (TYPES_STATIQUES.includes(requete.destination)) {
    evenement.respondWith(repondreStatique(requete))
    return
  }

  // 6. Tout le reste : comportement du navigateur, aucun cache
})

/* --------------------------------------------------------------------------
   Message depuis la page : vider les caches de l'application
   (portail /application, action « Vider le cache local »).
   -------------------------------------------------------------------------- */
self.addEventListener('message', (evenement) => {
  const donnees = evenement.data || {}
  if (donnees.action !== 'vider-caches') return
  evenement.waitUntil(
    caches
      .keys()
      .then((noms) => Promise.all(noms.map((nom) => caches.delete(nom))))
      .then(() => {
        // Le port de réponse peut avoir été fermé : l'échec est sans gravité
        try {
          evenement.ports?.[0]?.postMessage({ ok: true })
        } catch {
          /* ignoré */
        }
      }),
  )
})

/* --------------------------------------------------------------------------
   Notifications (préparation de la tâche 6.5 — aucune notification n'est
   émise tant que le backend n'en envoie pas ; ce code ne sert à rien avant).
   Le push est le protocole standard : sur Android et Chrome, il est transporté
   par FCM ; sur iOS installé, par APNs. Aucun SDK tiers n'est embarqué.
   -------------------------------------------------------------------------- */
self.addEventListener('push', (evenement) => {
  if (!evenement.data) return
  let contenu = { titre: 'Mia', corps: '', url: './index.html' }
  try {
    contenu = { ...contenu, ...evenement.data.json() }
  } catch {
    contenu.corps = evenement.data.text()
  }
  evenement.waitUntil(
    self.registration.showNotification(contenu.titre, {
      body: contenu.corps,
      icon: './icons/mia-192.png',
      badge: './icons/mia-192.png',
      lang: 'fr',
      data: { url: contenu.url },
    }),
  )
})

self.addEventListener('notificationclick', (evenement) => {
  evenement.notification.close()
  const cible = evenement.notification.data?.url || './index.html'
  evenement.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(cible) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(cible)
    }),
  )
})

/* --------------------------------------------------------------------------
   Page de secours : servie uniquement si une navigation échoue ET que la
   coquille n'est pas en cache (première visite hors ligne). Elle ne remplace
   jamais l'écran hors-ligne de l'application, qui est le cas normal.
   -------------------------------------------------------------------------- */
const PAGE_HORS_LIGNE = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mia — hors ligne</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #fdfcfa;
        color: #16151a;
        font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
        text-align: center;
      }
      main { max-width: 34rem; padding: 24px; }
      h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 30px; margin: 0 0 8px; }
      p { color: #6a676f; line-height: 1.65; }
    </style>
  </head>
  <body>
    <main>
      <h1>Mia n'a pas accès au réseau</h1>
      <p>
        Cette page n'a pas encore été enregistrée sur votre appareil. Reconnectez-vous, puis
        rouvrez Mia : la conversation reprendra normalement.
      </p>
    </main>
  </body>
</html>`
