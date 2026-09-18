/**
 * Tests de navigation du widget (tâche 6.2-bis) — les 4 onglets, l'écran
 * Conversation, la sémantique ARIA et les intentions de l'accueil.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App.vue'
import router from '@/router'
import { sendMessage } from '@/api/railway'
import { MESSAGE_PREFIX } from '@/helpers/sdkBridge'

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

function reponseIa() {
  return {
    text: 'Réponse de Mia',
    html: null,
    files: null,
    metadata: {
      conversation_id: 'conv_test',
      intent: 'greeting',
      agent_used: null,
      actions: [],
      suggestions: [],
      processing_time: 10,
    },
  }
}

async function monterWidget(route = '/') {
  const pinia = createPinia()
  await router.push(route)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return wrapper
}

beforeEach(async () => {
  localStorage.clear()
  // L'index du blog est indisponible : le widget sert sa copie embarquée.
  // Le test des onglets Aide/Actualités n'a donc aucune dépendance réseau.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  mockedSendMessage.mockReset()
  mockedSendMessage.mockResolvedValue(reponseIa())
})

describe('Widget — structure à 4 onglets', () => {
  it('ouvre sur l’onglet Accueil (Bonjour, carte de saisie, 9 capacités)', async () => {
    const wrapper = await monterWidget('/')

    expect(wrapper.find('h1').text()).toBe('Bonjour')
    expect(wrapper.text()).toContain('En quoi pouvons-nous vous être utile ?')
    expect(wrapper.text()).toContain('Poser une question')
    expect(wrapper.text()).toContain('Trouver une réponse')

    // A.8 — les trois familles et leurs neuf capacités, sans nom d'agent
    expect(wrapper.text()).toContain('Développer mon activité')
    expect(wrapper.text()).toContain('Visibilité & Acquisition')
    expect(wrapper.text()).toContain('Automatisation & IA')
    expect(wrapper.findAll('[data-suggestion]')).toHaveLength(9)
  })

  it('expose quatre onglets role="tab" avec un seul actif', async () => {
    const wrapper = await monterWidget('/')

    const onglets = wrapper.findAll('[role="tab"]')
    expect(onglets).toHaveLength(4)
    expect(onglets.map((o) => o.text())).toEqual([
      'Accueil',
      'Messages',
      'Aide',
      'Actualités',
    ])

    const actifs = onglets.filter((o) => o.attributes('aria-selected') === 'true')
    expect(actifs).toHaveLength(1)
    expect(actifs[0].attributes('id')).toBe('ep-tab-home')

    // Le panneau porte role="tabpanel" et pointe vers l'onglet actif
    const panneau = wrapper.find('[role="tabpanel"]')
    expect(panneau.attributes('id')).toBe('ep-panel-home')
    expect(panneau.attributes('aria-labelledby')).toBe('ep-tab-home')
  })

  it('navigue entre onglets au clic, sans recharger (hash history)', async () => {
    const wrapper = await monterWidget('/')

    await wrapper.find('#ep-tab-aide').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('aide')
    expect(wrapper.find('#ep-tab-aide').attributes('aria-selected')).toBe('true')
    expect(wrapper.find('#ep-tab-home').attributes('aria-selected')).toBe('false')
    expect(wrapper.text()).toContain('collection')
  })

  it('parcourt les onglets au clavier (flèches, Début, Fin)', async () => {
    const wrapper = await monterWidget('/')

    await wrapper.find('#ep-tab-home').trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('messages')

    await wrapper.find('#ep-tab-messages').trigger('keydown', { key: 'End' })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('actualites')

    await wrapper.find('#ep-tab-actualites').trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    // Fin de liste → retour au premier onglet
    expect(router.currentRoute.value.name).toBe('home')

    await wrapper.find('#ep-tab-home').trigger('keydown', { key: 'ArrowLeft' })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('actualites')
  })

  it('l’onglet Aide propose les 9 capacités puis les collections', async () => {
    const wrapper = await monterWidget('/aide')

    // A.9 — « Ce que Mia peut faire pour vous », mêmes intents que l'accueil
    expect(wrapper.text()).toContain('Ce que Mia peut faire pour vous')
    const capacites = wrapper.findAll('.ep-ligne--capacite')
    expect(capacites).toHaveLength(9)
    expect(capacites.map((c) => c.attributes('data-suggestion'))).toEqual([
      'clients',
      'mlm',
      'ventes',
      'site_web',
      'seo',
      'ads',
      'social',
      'ia_auto',
      'funnel',
    ])

    expect(wrapper.text()).toMatch(/\d+ collections?/)
    expect(wrapper.text()).toContain('IA générative')

    // Ouvre une collection : la liste se remplace par ses articles
    // (`.ep-ligne` sans modificateur = une collection, pas une capacité)
    await wrapper.find('.ep-ligne:not(.ep-ligne--capacite)').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Toutes les collections')
    expect(wrapper.text()).toContain('article')

    // Retour à la liste des collections
    await wrapper.find('.ep-retour').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toMatch(/\d+ collections?/)
  })

  it('l’onglet Actualités affiche les articles, les plus récents d’abord', async () => {
    const wrapper = await monterWidget('/actualites')

    expect(wrapper.find('h1').text()).toBe('Actualités')
    expect(wrapper.text()).toContain('Les plus récentes')
    expect(wrapper.text()).toContain('De l’équipe ePerformance')

    const titres = wrapper.findAll('.ep-article__titre').map((t) => t.text())
    expect(titres.length).toBeGreaterThan(0)
    // Le premier article est le plus récent (tri décroissant sur la date)
    expect(titres[0]).toBe('IA et service client : répondre la nuit sans recruter')
  })

  it('une capacité de l’accueil ouvre la conversation et envoie `[intent:…]`', async () => {
    const wrapper = await monterWidget('/')

    const suggestion = wrapper
      .findAll('.ep-suggestion')
      .find((bouton) => bouton.attributes('data-suggestion') === 'seo')
    expect(suggestion).toBeTruthy()
    await suggestion!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('conversation')
    expect(mockedSendMessage).toHaveBeenCalledTimes(1)
    const premierAppel = mockedSendMessage.mock.calls[0]
    // Le PAYLOAD porte le préfixe d'intent, interprété par le backend seul
    expect(premierAppel[0].messages.at(-1)).toEqual({
      role: 'user',
      text: '[intent:seo] Améliorer mon référencement',
    })
    // Le clic est tracé et voyage avec le message (suggestion_id + session)
    expect(premierAppel[0].extraVisitorInfo?.suggestion_click).toMatchObject({
      suggestion_id: 'seo',
      intent: 'seo',
      label: 'Améliorer mon référencement',
    })
  })

  it('l’écran Conversation garde la barre d’onglets en mobile, pas en desktop', async () => {
    // jsdom : matchMedia n'existe pas → estMobile reste false (desktop)
    const wrapper = await monterWidget('/conversation')

    expect(wrapper.find('.ep-chat').exists()).toBe(true)
    // Desktop : pas de barre d'onglets, le retour du header fait le travail
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(0)
    expect(wrapper.find('[aria-label="Revenir à la liste des conversations"]').exists()).toBe(true)
  })

  it('suit le gabarit transmis par le SDK (viewport) sur l’écran Conversation', async () => {
    const wrapper = await monterWidget('/conversation')
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(0)

    // Le SDK (qui voit la vraie fenêtre) annonce un écran mobile :
    // la barre d'onglets reste visible, comme le fait Intercom.
    window.dispatchEvent(
      new MessageEvent('message', {
        data: `${MESSAGE_PREFIX}${JSON.stringify({ event: 'viewport', viewport: 'mobile' })}`,
      }),
    )
    await flushPromises()
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(4)

    // Retour en desktop : la barre s'efface au profit du retour du header
    window.dispatchEvent(
      new MessageEvent('message', {
        data: `${MESSAGE_PREFIX}${JSON.stringify({ event: 'viewport', viewport: 'desktop' })}`,
      }),
    )
    await flushPromises()
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(0)
  })
})
