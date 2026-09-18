/**
 * Tests du réglage « Notifications » tel que le visiteur le voit (P3-PUSH).
 *
 * Le composant est monté avec le VRAI store et le VRAI helper : ce qui est
 * vérifié ici, c'est ce que le visiteur voit et ce que son clic déclenche —
 * pas une maquette.
 *
 * CE QUI EST VERROUILLÉ
 *   · aucun bloc, et AUCUNE demande de permission, quand la fonctionnalité
 *     n'est pas proposable (pas d'API push, serveur non configuré) ;
 *   · le montage ne demande jamais la permission : c'est le clic qui la
 *     demande, et rien d'autre ;
 *   · un visiteur qui a refusé voit son état, sans bouton pour le relancer ;
 *   · l'abonné peut se désabonner, en un clic, et le serveur est prévenu ;
 *   · un échec est affiché et peut être réessayé.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ReglageNotifications from '@/components/ReglageNotifications.vue'
import { CLE_ETAT_NOTIFICATIONS, MESSAGE_REFUS } from '@/helpers/push'

const CLE_PUBLIQUE_TEST = 'B' + 'A'.repeat(86)
const ENDPOINT_TEST = 'https://fcm.googleapis.com/fcm/send/jeton-de-test'

// ============================================================
// DOUBLES DE TEST
// ============================================================

function fausseSouscription() {
  return {
    endpoint: ENDPOINT_TEST,
    toJSON: () => ({
      endpoint: ENDPOINT_TEST,
      keys: { p256dh: 'B'.repeat(87), auth: 'C'.repeat(22) },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  }
}

interface Options {
  pushManager?: boolean
  permission?: NotificationPermission | false
  reponsePermission?: NotificationPermission
  config?: { configure: boolean; cle_publique: string | null } | null
  statutSubscribe?: number
  souscription?: ReturnType<typeof fausseSouscription> | null
}

function installer(options: Options = {}) {
  const {
    pushManager = true,
    permission = 'default',
    reponsePermission,
    config = { configure: true, cle_publique: CLE_PUBLIQUE_TEST },
    statutSubscribe = 200,
    souscription = null,
  } = options

  vi.stubGlobal('isSecureContext', true)

  const abonnement = souscription ?? fausseSouscription()
  const enregistrement = {
    active: {},
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(souscription),
      subscribe: vi.fn().mockResolvedValue(abonnement),
    },
  }
  vi.stubGlobal('navigator', {
    userAgent: 'Test/1.0',
    maxTouchPoints: 0,
    serviceWorker: {
      getRegistration: vi.fn().mockResolvedValue(enregistrement),
      ready: Promise.resolve(enregistrement),
      register: vi.fn().mockResolvedValue(enregistrement),
    },
  })
  if (pushManager) vi.stubGlobal('PushManager', class PushManagerFausse {})

  let classeNotification: { permission: NotificationPermission; requestPermission: ReturnType<typeof vi.fn> } | null =
    null
  if (permission !== false) {
    classeNotification = vi.fn() as unknown as {
      permission: NotificationPermission
      requestPermission: ReturnType<typeof vi.fn>
    }
    classeNotification.permission = permission
    classeNotification.requestPermission = vi
      .fn()
      .mockResolvedValue(reponsePermission ?? permission)
    vi.stubGlobal('Notification', classeNotification)
  }

  const appels: Array<{ url: string; methode: string }> = []
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    appels.push({ url: String(url), methode: String(init?.method ?? 'GET') })
    if (String(url).includes('/push/config')) {
      if (!config) throw new Error('réseau indisponible')
      return { ok: true, status: 200, json: async () => config } as unknown as Response
    }
    if (String(url).includes('/push/subscribe')) {
      return {
        ok: statutSubscribe < 300,
        status: statutSubscribe,
        json: async () => ({}),
      } as unknown as Response
    }
    if (String(url).includes('/push/unsubscribe')) {
      return { ok: true, status: 200, json: async () => ({}) } as unknown as Response
    }
    throw new Error(`URL inattendue : ${url}`)
  })
  vi.stubGlobal('fetch', fetchImpl)

  return { enregistrement, classeNotification, appels, fetchImpl, souscription: abonnement }
}

async function monter() {
  const wrapper = mount(ReglageNotifications, { global: { plugins: [createPinia()] } })
  await flushPromises()
  return wrapper
}

function memoire(abonne: boolean) {
  localStorage.setItem(
    CLE_ETAT_NOTIFICATIONS,
    JSON.stringify({ abonne, endpoint: abonne ? ENDPOINT_TEST : null, erreurLe: null }),
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

// ============================================================
// 1. CE QUI NE S'AFFICHE PAS — DÉGRADATION PROPRE
// ============================================================

describe('Réglage absent quand la fonctionnalité n’est pas proposable', () => {
  it('n’affiche RIEN quand l’API push n’existe pas (navigateur ancien, iOS non installé)', async () => {
    installer({ pushManager: false, permission: false })
    const wrapper = await monter()

    expect(wrapper.find('[data-testid="notifications-action"]').exists()).toBe(false)
    expect(wrapper.find('section').exists()).toBe(false)
    expect(wrapper.text().trim()).toBe('')
  })

  it('n’affiche RIEN quand le serveur n’a pas de clé publique (production actuelle)', async () => {
    installer({ config: { configure: false, cle_publique: null } })
    const wrapper = await monter()

    expect(wrapper.find('section').exists()).toBe(false)
    expect(wrapper.text().trim()).toBe('')
  })

  it('n’affiche RIEN quand le serveur est injoignable — sans erreur visible', async () => {
    installer({ config: null })
    const wrapper = await monter()

    expect(wrapper.find('section').exists()).toBe(false)
    expect(wrapper.text().trim()).toBe('')
  })

  it('ne demande JAMAIS la permission quand il n’affiche rien', async () => {
    const { classeNotification } = installer({ config: { configure: false, cle_publique: null } })
    await monter()

    expect(classeNotification?.requestPermission).not.toHaveBeenCalled()
  })

  it('n’affiche RIEN dans une iframe — règle de la tâche 6.4', async () => {
    // Dans une iframe, le widget n'enregistre pas de service worker et le
    // navigateur refuse de toute façon la permission : la fonctionnalité n'est
    // pas proposée, sans erreur.
    vi.stubGlobal('top', {})
    installer()
    const wrapper = await monter()

    expect(wrapper.find('section').exists()).toBe(false)
    expect(wrapper.text().trim()).toBe('')
  })
})

// ============================================================
// 2. LE MONTAGE NE DEMANDE RIEN
// ============================================================

describe('Le montage ne déclenche aucune demande', () => {
  it('affiche le réglage quand tout est en place', async () => {
    installer()
    const wrapper = await monter()

    expect(wrapper.find('[data-testid="notifications-action"]').text()).toBe('Activer')
    expect(wrapper.text()).toContain('Recevoir les nouvelles de Mia')
  })

  it('ne demande AUCUNE permission au chargement — la règle la plus importante', async () => {
    const { classeNotification } = installer({ permission: 'default' })
    await monter()

    expect(classeNotification?.requestPermission).not.toHaveBeenCalled()
  })

  it('n’envoie AUCUN abonnement au chargement', async () => {
    const { appels } = installer()
    await monter()

    expect(appels.filter((a) => a.url.includes('subscribe'))).toHaveLength(0)
  })

  it('ne lit la configuration qu’une fois', async () => {
    const { appels } = installer()
    await monter()

    expect(appels.filter((a) => a.url.includes('/config'))).toHaveLength(1)
  })
})

// ============================================================
// 3. LE CLIC ACTIVE — ET RIEN D'AUTRE
// ============================================================

describe('Activation par le clic', () => {
  it('le clic demande la permission, s’abonne, puis affiche l’état abonné', async () => {
    const { classeNotification, appels } = installer({ permission: 'default', reponsePermission: 'granted' })
    const wrapper = await monter()

    await wrapper.find('[data-testid="notifications-action"]').trigger('click')
    await flushPromises()

    expect(classeNotification?.requestPermission).toHaveBeenCalledTimes(1)
    expect(appels.filter((a) => a.url.includes('subscribe'))).toHaveLength(1)
    expect(wrapper.text()).toContain('Mia peut vous prévenir')
    expect(wrapper.find('[data-testid="notifications-action"]').text()).toBe('Désactiver')
  })

  it('s’abonne avec la clé publique servie par le serveur', async () => {
    const { enregistrement } = installer({ permission: 'default', reponsePermission: 'granted' })
    const wrapper = await monter()

    await wrapper.find('[data-testid="notifications-action"]').trigger('click')
    await flushPromises()

    const options = enregistrement.pushManager.subscribe.mock.calls[0][0]
    expect(options.applicationServerKey).toBeInstanceOf(Uint8Array)
    expect(options.applicationServerKey.length).toBe(65)
  })

  it('un refus affiche l’état refusé SANS proposer de relancer', async () => {
    installer({ permission: 'default', reponsePermission: 'denied' })
    const wrapper = await monter()

    await wrapper.find('[data-testid="notifications-action"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Notifications refusées')
    expect(wrapper.text()).toContain(MESSAGE_REFUS)
    expect(wrapper.find('[data-testid="notifications-action"]').exists()).toBe(false)
  })

  it('ne relance jamais un visiteur qui a refusé', async () => {
    const { classeNotification } = installer({ permission: 'denied' })
    const wrapper = await monter()

    expect(classeNotification?.requestPermission).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="notifications-action"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Notifications refusées')
  })

  it('un échec d’enregistrement affiche une erreur et un bouton pour réessayer', async () => {
    installer({ permission: 'default', reponsePermission: 'granted', statutSubscribe: 503 })
    const wrapper = await monter()

    await wrapper.find('[data-testid="notifications-action"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="notifications-action"]').text()).toBe('Réessayer')
    expect(wrapper.find('[data-testid="notifications-message"]').exists()).toBe(true)
  })
})

// ============================================================
// 4. DÉSABONNEMENT
// ============================================================

describe('Désabonnement par le clic', () => {
  it('affiche l’état abonné quand la permission est accordée et l’abonnement mémorisé', async () => {
    installer({ permission: 'granted', souscription: fausseSouscription() })
    memoire(true)
    const wrapper = await monter()

    expect(wrapper.text()).toContain('Mia peut vous prévenir')
    expect(wrapper.find('[data-testid="notifications-action"]').text()).toBe('Désactiver')
  })

  it('le clic prévient le serveur et désabonne le navigateur', async () => {
    const souscription = fausseSouscription()
    const { appels } = installer({ permission: 'granted', souscription })
    memoire(true)
    const wrapper = await monter()

    await wrapper.find('[data-testid="notifications-action"]').trigger('click')
    await flushPromises()

    expect(appels.filter((a) => a.url.includes('unsubscribe') && a.methode === 'DELETE')).toHaveLength(1)
    expect(souscription.unsubscribe).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="notifications-action"]').text()).toBe('Activer')
  })

  it('resynchronise un abonnement déjà consenti, sans rien demander', async () => {
    const { classeNotification, appels } = installer({
      permission: 'granted',
      souscription: fausseSouscription(),
    })
    memoire(true)
    await monter()

    expect(appels.filter((a) => a.url.includes('subscribe'))).toHaveLength(1)
    expect(classeNotification?.requestPermission).not.toHaveBeenCalled()
  })
})

// ============================================================
// 5. ACCESSIBILITÉ ET ANATOMIE
// ============================================================

describe('Accessibilité du réglage', () => {
  it('le bouton est un vrai bouton, dans une section intitulée', async () => {
    installer()
    const wrapper = await monter()

    const bouton = wrapper.find('[data-testid="notifications-action"]')
    expect(bouton.attributes('type')).toBe('button')
    const section = wrapper.find('section')
    expect(section.attributes('aria-labelledby')).toBe('ep-notifs-titre')
    expect(wrapper.find('#ep-notifs-titre').text()).toBe('Notifications')
  })

  it('le message d’état est annoncé aux lecteurs d’écran', async () => {
    installer({ permission: 'default', reponsePermission: 'granted' })
    const wrapper = await monter()

    await wrapper.find('[data-testid="notifications-action"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="notifications-message"]').attributes('role')).toBe('status')
  })

  it('neutralise le bouton pendant l’opération', async () => {
    installer({ permission: 'default', reponsePermission: 'granted' })
    const wrapper = await monter()

    await wrapper.find('[data-testid="notifications-action"]').trigger('click')
    // Juste après le clic, l'opération est en cours : le bouton doit être
    // neutralisé pour éviter un second envoi.
    expect(wrapper.find('[data-testid="notifications-action"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="notifications-action"]').attributes('aria-busy')).toBe('true')

    await flushPromises()
  })

  it('aucun emoji dans l’interface', async () => {
    installer({ permission: 'granted', souscription: fausseSouscription() })
    memoire(true)
    const wrapper = await monter()

    expect(wrapper.text()).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
  })
})

// ============================================================
// 6. LE RÉGLAGE DANS LE WIDGET RÉEL — ONGLET AIDE
// ============================================================

describe('Le réglage dans l’onglet Aide du widget', () => {
  /** Monte le widget complet (routeur + Pinia), comme la production */
  async function monterWidget(route: string) {
    const { default: App } = await import('@/App.vue')
    const { default: routeur } = await import('@/router')
    await routeur.push(route)
    await routeur.isReady()
    const wrapper = mount(App, { global: { plugins: [createPinia(), routeur] } })
    await flushPromises()
    return wrapper
  }

  it('affiche le réglage dans l’onglet Aide quand le serveur est configuré', async () => {
    installer()
    const wrapper = await monterWidget('/aide')

    expect(wrapper.find('[data-testid="notifications-action"]').exists()).toBe(true)
    // Non-régression : le contenu d'aide est toujours là, sous le réglage.
    expect(wrapper.text()).toContain('Ce que Mia peut faire pour vous')
  })

  it('ne demande aucune permission en ouvrant l’onglet Aide', async () => {
    const { classeNotification } = installer({ permission: 'default' })
    await monterWidget('/aide')

    expect(classeNotification?.requestPermission).not.toHaveBeenCalled()
  })

  it('les autres onglets ne sont pas modifiés : le réglage n’y apparaît pas', async () => {
    installer()
    const accueil = await monterWidget('/')
    expect(accueil.find('[data-testid="notifications-action"]').exists()).toBe(false)
    expect(accueil.text()).toContain('Bonjour')

    const actualites = await monterWidget('/actualites')
    expect(actualites.find('[data-testid="notifications-action"]').exists()).toBe(false)
  })
})
