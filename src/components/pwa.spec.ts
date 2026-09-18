/**
 * Tests de la tâche 6.4 — invite d'installation et écran hors-ligne, montés
 * dans le widget réel (App.vue), avec la même installation que la production
 * (routeur à hash + Pinia).
 *
 * Ce que ces tests verrouillent :
 *   · l'invite n'apparaît pas au premier chargement ni pendant une conversation ;
 *   · elle apparaît à la deuxième visite, au-dessus du contenu, et JAMAIS
 *     par-dessus la zone de saisie (position dans le flux, pas de flottant) ;
 *   · « Plus tard » mémorise le refus 30 jours ;
 *   · l'écran hors-ligne s'affiche quand le document perd le réseau et
 *     disparaît quand il le retrouve (retour automatique).
 */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App.vue'
import router from '@/router'
import { getConversation, sendMessage } from '@/api/railway'
import { CLE_ETAT_INSTALLATION, lireEtatInstallation } from '@/helpers/installation'
import { horsLigne } from '@/helpers/reseau'

vi.mock('@/api/railway', () => ({
  ConversationNotFoundError: class ConversationNotFoundError extends Error {
    constructor() {
      super('Conversation not found')
      this.name = 'ConversationNotFoundError'
    }
  },
  sendMessage: vi.fn(),
  getConversation: vi.fn().mockRejectedValue(new Error('404')),
}))

const mockedSendMessage = vi.mocked(sendMessage)
const mockedGetConversation = vi.mocked(getConversation)

/** Deuxième visite, aucun refus : l'état d'un visiteur à qui l'invite peut être proposée */
function etatDeuxiemeVisite() {
  localStorage.setItem(
    CLE_ETAT_INSTALLATION,
    JSON.stringify({ refusLe: null, visites: 2, installee: false }),
  )
}

async function monterWidget(route = '/') {
  const pinia = createPinia()
  await router.push(route)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  localStorage.clear()
  vi.useRealTimers()
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  mockedSendMessage.mockReset()
  mockedGetConversation.mockRejectedValue(new Error('404'))
  horsLigne.value = false
})

describe('Invite d’installation dans le widget', () => {
  it('n’affiche rien au premier chargement (aucune visite en mémoire)', async () => {
    const wrapper = await monterWidget('/')
    expect(wrapper.find('[data-testid="invite-installation"]').exists()).toBe(false)
  })

  it('n’affiche rien tant que le délai de politesse n’est pas écoulé', async () => {
    etatDeuxiemeVisite()
    const wrapper = await monterWidget('/')
    // Le montage vient d'avoir lieu : le minuteur n'a pas encore parlé
    expect(wrapper.find('[data-testid="invite-installation"]').exists()).toBe(false)
  })

  it('apparaît à la deuxième visite, une fois le délai écoulé', async () => {
    vi.useFakeTimers()
    etatDeuxiemeVisite()
    const wrapper = await monterWidget('/')

    await vi.advanceTimersByTimeAsync(12_100)
    await flushPromises()

    const invite = wrapper.find('[data-testid="invite-installation"]')
    expect(invite.exists()).toBe(true)
    expect(invite.text()).toContain('Gardez Mia sous la main')
    expect(invite.text()).toContain('Plus tard')
  })

  it('n’apparaît jamais sur l’écran Conversation', async () => {
    vi.useFakeTimers()
    etatDeuxiemeVisite()
    const wrapper = await monterWidget('/conversation')
    await vi.advanceTimersByTimeAsync(12_100)
    await flushPromises()
    expect(wrapper.find('[data-testid="invite-installation"]').exists()).toBe(false)
  })

  it('« Plus tard » masque l’invite et mémorise le refus', async () => {
    vi.useFakeTimers()
    etatDeuxiemeVisite()
    const wrapper = await monterWidget('/')
    await vi.advanceTimersByTimeAsync(12_100)
    await flushPromises()

    const bouton = wrapper.find('.ep-invite__plus-tard')
    expect(bouton.exists()).toBe(true)
    await bouton.trigger('click')

    expect(wrapper.find('[data-testid="invite-installation"]').exists()).toBe(false)
    expect(lireEtatInstallation(localStorage).refusLe).not.toBeNull()
  })

  it('est posée dans le flux, au-dessus du contenu — jamais en flottant', async () => {
    vi.useFakeTimers()
    etatDeuxiemeVisite()
    const wrapper = await monterWidget('/')
    await vi.advanceTimersByTimeAsync(12_100)
    await flushPromises()

    const app = wrapper.find('.ep-app')
    const enfants = Array.from(app.element.children).map((el) => el.className)
    // Ordre du flux : header, invite, corps, onglets, voile hors-ligne
    expect(enfants[0]).toContain('ep-header')
    expect(enfants[1]).toContain('ep-invite')
    expect(enfants[2]).toContain('ep-corps')
  })
})

describe('Écran hors-ligne', () => {
  it('ne s’affiche pas quand le réseau est là', async () => {
    const wrapper = await monterWidget('/')
    expect(wrapper.find('[data-testid="ecran-hors-ligne"]').exists()).toBe(false)
  })

  it('s’affiche à la perte du réseau et disparaît à son retour', async () => {
    const wrapper = await monterWidget('/')

    vi.stubGlobal('navigator', { onLine: false, userAgent: navigator.userAgent })
    window.dispatchEvent(new Event('offline'))
    await flushPromises()

    const voile = wrapper.find('[data-testid="ecran-hors-ligne"]')
    expect(voile.exists()).toBe(true)
    expect(voile.text()).toContain('Mia a besoin du réseau')
    // Le contenu de l'application est rendu inerte derrière l'écran d'attente
    expect(wrapper.find('.ep-corps').attributes('inert')).toBeDefined()

    vi.stubGlobal('navigator', { onLine: true, userAgent: navigator.userAgent })
    window.dispatchEvent(new Event('online'))
    await flushPromises()

    expect(wrapper.find('[data-testid="ecran-hors-ligne"]').exists()).toBe(false)
    expect(wrapper.find('.ep-corps').attributes('inert')).toBeUndefined()
  })
})
