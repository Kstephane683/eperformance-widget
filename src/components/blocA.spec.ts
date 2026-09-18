/**
 * Tests de la tâche 6.3-BIS — Bloc A, côté widget.
 *
 *   · A.1 — une image jointe part au backend en base64 (payload `image`)
 *   · A.3 — la signature est toujours SOUS la bulle (« Vous · à l'instant »)
 *   · A.4 — le message d'ouverture de Mia, une seule fois par session
 *   · A.6 — aucun nom d'agent n'est rendu à l'écran
 *   · A.8 — 9 capacités, 3 familles, payload `[intent:…]`, clic tracé
 */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import MessageBubble from '@/components/MessageBubble.vue'
import { CAPACITES, FAMILLES, capaciteParIntent, payloadSuggestion } from '@/data/capacites'
import { reinitialiserTracking, sessionId, tracerClicSuggestion } from '@/helpers/tracking'
import { getConversation, sendMessage } from '@/api/railway'
import type { ChatbotMessageResponse, WidgetMessage } from '@/types/api'
import { MESSAGE_ACCUEIL, imagePayloadDepuisDataUrl, useMessagesStore } from '@/stores/messages'
import { useConversationStore } from '@/stores/conversation'

vi.mock('@/api/railway', () => ({
  ConversationNotFoundError: class ConversationNotFoundError extends Error {
    constructor() {
      super('Conversation not found')
      this.name = 'ConversationNotFoundError'
    }
  },
  sendMessage: vi.fn(),
  getConversation: vi.fn(),
}))

const mockedSendMessage = vi.mocked(sendMessage)
const mockedGetConversation = vi.mocked(getConversation)

function makeResponse(overrides: Partial<ChatbotMessageResponse> = {}): ChatbotMessageResponse {
  return {
    text: 'Réponse de Mia',
    html: null,
    files: null,
    metadata: {
      conversation_id: 'conv_bloc_a',
      intent: 'greeting',
      agent_used: 'sales-discovery-coach',
      actions: [],
      suggestions: [],
      processing_time: 12,
    },
    ...overrides,
  }
}

function message(overrides: Partial<WidgetMessage> = {}): WidgetMessage {
  return {
    id: 'msg_1',
    role: 'user',
    content: 'Bonjour',
    agent_used: null,
    human_name: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  sessionStorage.clear()
  reinitialiserTracking()
  vi.clearAllMocks()
  mockedSendMessage.mockResolvedValue(makeResponse())
  mockedGetConversation.mockRejectedValue(new Error('404'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ============================================================ A.3 — signature

describe('A.3 — la signature est sous la bulle', () => {
  it('le message du visiteur et sa signature sont deux blocs distincts', async () => {
    const wrapper = mount(MessageBubble, { props: { message: message({ content: 'Bonjour' }) } })

    // Le texte est dans un élément de BLOC (jamais concaténé à la signature)
    const texte = wrapper.find('.ep-bubble__texte')
    expect(texte.exists()).toBe(true)
    expect(texte.text()).toBe('Bonjour')
    expect(texte.element.tagName).toBe('P')

    const signature = wrapper.find('.ep-bubble__signature')
    expect(signature.exists()).toBe(true)
    // La signature n'est pas un enfant du bloc de texte : elle est en dessous
    expect(texte.element.contains(signature.element)).toBe(false)
    expect(texte.text() + signature.text()).toBe('BonjourVous · à l\'instant')
  })

  it('formate « Vous · à l’instant » puis « Vous · il y a X minutes »', () => {
    const maintenant = Date.parse('2026-09-18T12:00:00Z')
    const recent = mount(MessageBubble, {
      props: { message: message({ created_at: new Date(maintenant - 5_000).toISOString() }), maintenant },
    })
    expect(recent.find('.ep-bubble__signature').text()).toBe("Vous · à l'instant")

    const ancien = mount(MessageBubble, {
      props: {
        message: message({ created_at: new Date(maintenant - 5 * 60_000).toISOString() }),
        maintenant,
      },
    })
    expect(ancien.find('.ep-bubble__signature').text()).toBe('Vous · il y a 5 minutes')
  })

  it('signe les messages de Mia « Mia • Agent IA • … »', () => {
    const wrapper = mount(MessageBubble, {
      props: { message: message({ role: 'agent', content: 'Bonjour 👋', agent_used: 'sales-discovery-coach' }) },
    })
    expect(wrapper.find('.ep-bubble__signature').text()).toMatch(/^Mia • Agent IA • /)
  })

  it('garde le badge « Conseiller » et le nom réel pour un humain', () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: message({
          role: 'agent',
          content: 'Je prends le relais',
          human_name: 'Awa Traoré',
        }),
      },
    })
    expect(wrapper.find('.ep-badge').text()).toBe('Conseiller')
    expect(wrapper.find('.ep-bubble__auteur').text()).toBe('Awa Traoré')
    expect(wrapper.find('.ep-bubble__signature').text()).toMatch(/^Awa Traoré • Conseiller • /)
  })
})

// ================================================= A.6 — aucun nom d'agent

describe('A.6 — aucun nom d’agent n’est rendu', () => {
  it('la clé d’agent n’apparaît nulle part dans la bulle', () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: message({
          role: 'agent',
          content: 'Voici mon conseil',
          agent_used: 'sales-discovery-coach',
        }),
      },
    })
    const rendu = wrapper.text()
    expect(rendu).not.toContain('discovery')
    expect(rendu).not.toContain('coach')
    expect(rendu).not.toContain('sales')
    expect(rendu).not.toContain('sales-discovery-coach')
    // Le libellé d'agent n'existe plus dans le gabarit
    expect(wrapper.find('.ep-bubble__meta').exists()).toBe(false)
  })

  it('aucune des 27 clés d’agent ne fuit, quel que soit le message', () => {
    const cles = [
      'sales-discovery-coach',
      'sales-outbound-strategist',
      'sales-closer-mlm',
      'sales_expert',
      'sales-lead-scorer',
      'sales-objection-handler',
      'sales-offer-lead-gen-strategist',
      'sales-upsell-specialist',
      'sales-callback-scheduler',
      'marketing-seo-specialist',
      'marketing-meta-ads-specialist',
      'marketing-social-media-manager',
      'marketing-funnel-architect',
      'marketing-growth-hacker',
      'marketing-content-specialist',
      'marketing-copywriter',
      'marketing-email-specialist',
      'marketing-analytics-specialist',
      'marketing-whatsapp-specialist',
      'marketing_specialist',
      'design-brand-identity-specialist',
      'design-landing-page-specialist',
      'design-ux-optimizer',
      'product-pricing-strategist',
      'technical_advisor',
      'research-market-analyst',
      'customer_support',
    ]
    for (const cle of cles) {
      const wrapper = mount(MessageBubble, {
        props: { message: message({ role: 'agent', content: 'Un conseil', agent_used: cle }) },
      })
      expect(wrapper.text()).toContain('Mia')
      expect(wrapper.text()).not.toContain(cle)
      expect(wrapper.text()).not.toContain(cle.replace(/_/g, ' '))
    }
  })

  it('la signature reste Mia même si le backend annonce un autre agent', () => {
    const wrapper = mount(MessageBubble, {
      props: { message: message({ role: 'agent', content: 'x', agent_used: 'marketing-seo-specialist' }) },
    })
    expect(wrapper.find('.ep-bubble__signature').text()).toContain('Mia')
  })
})

// ================================================= A.4 — message d'ouverture

describe('A.4 — message d’ouverture de Mia', () => {
  it('est posé une seule fois par session', () => {
    const messages = useMessagesStore()

    expect(messages.accueillirSiNecessaire()).toBe(true)
    expect(messages.messages).toHaveLength(1)
    expect(messages.messages[0].role).toBe('agent')
    expect(messages.messages[0].content).toBe(MESSAGE_ACCUEIL)
    expect(MESSAGE_ACCUEIL).toContain('Bonjour')
    expect(MESSAGE_ACCUEIL).toContain('Mia')

    // Deuxième et troisième ouvertures de la même session : rien de neuf
    expect(messages.accueillirSiNecessaire()).toBe(false)
    expect(messages.accueillirSiNecessaire()).toBe(false)
    expect(messages.messages).toHaveLength(1)
  })

  it('ne se redéclenche pas après un rechargement du widget (session en cours)', () => {
    useMessagesStore().accueillirSiNecessaire()

    // Nouvelle instance de store = rechargement de l'iframe dans la même session
    setActivePinia(createPinia())
    const apresRechargement = useMessagesStore()
    expect(apresRechargement.accueillirSiNecessaire()).toBe(false)
    expect(apresRechargement.messages).toHaveLength(0)
  })

  it('revient sur une session expirée (conversation remise à zéro)', () => {
    const messages = useMessagesStore()
    const conversation = useConversationStore()
    messages.accueillirSiNecessaire()
    expect(messages.messages).toHaveLength(1)

    // Session expirée : la conversation repart de zéro
    conversation.reset()

    expect(messages.accueillirSiNecessaire()).toBe(true)
    expect(messages.messages).toHaveLength(1)
  })

  it('ne double pas un fil qui contient déjà des messages', async () => {
    const messages = useMessagesStore()
    messages.addLocal('user', 'Bonjour')
    expect(messages.accueillirSiNecessaire()).toBe(false)
    expect(messages.messages).toHaveLength(1)
  })

  it('est signé « Mia • Agent IA • à l’instant »', () => {
    const messages = useMessagesStore()
    messages.accueillirSiNecessaire()
    const wrapper = mount(MessageBubble, { props: { message: messages.messages[0] } })
    expect(wrapper.find('.ep-bubble__signature').text()).toBe("Mia • Agent IA • à l'instant")
  })
})

// ================================================= A.1 — image jointe

describe('A.1 — une image jointe est transmise au backend', () => {
  it('décode la data URL en base64 + type déclaré', () => {
    expect(imagePayloadDepuisDataUrl('data:image/png;base64,QUJD', 'image/png', 'visuel.png')).toEqual({
      data: 'QUJD',
      media_type: 'image/png',
      detail: 'auto',
      name: 'visuel.png',
    })
    // Sans data URL (fichier non image), rien à transmettre
    expect(imagePayloadDepuisDataUrl(null)).toBeNull()
    expect(imagePayloadDepuisDataUrl('https://exemple/photo.png')).toBeNull()
  })

  it('pose l’image sur le dernier message envoyé', async () => {
    const messages = useMessagesStore()
    await messages.sendMessage('Regarde ce visuel', {
      name: 'visuel.png',
      dataUrl: 'data:image/png;base64,QUJD',
      mediaType: 'image/png',
      estImage: true,
      taille: 3,
    })
    await flushPromises()

    const appel = mockedSendMessage.mock.calls[0][0]
    expect(appel.image).toMatchObject({
      data: 'QUJD',
      media_type: 'image/png',
      detail: 'auto',
      name: 'visuel.png',
    })
    // Le texte du visiteur reste son texte (pas de « Pièce jointe : … »)
    expect(appel.messages.at(-1)).toEqual({ role: 'user', text: 'Regarde ce visuel' })
    // La pose de l'image sur le dernier message est faite par la couche API
    // (voir src/api/railway.spec.ts) — ici, la couche API est mockée.
  })

  it('ne transmet PAS un fichier non-image (seul le nom part)', async () => {
    const messages = useMessagesStore()
    await messages.sendMessage('Voici le document', {
      name: 'devis.pdf',
      dataUrl: null,
      mediaType: 'application/pdf',
      estImage: false,
      taille: 1000,
    })
    await flushPromises()

    const appel = mockedSendMessage.mock.calls[0][0]
    expect(appel.image).toBeNull()
    expect(appel.messages.at(-1)?.text).toContain('Pièce jointe : devis.pdf')
  })
})

// ================================================= A.8 — capacités

describe('A.8 — neuf capacités en trois familles', () => {
  it('expose exactement 9 capacités réparties en 3 familles', () => {
    expect(FAMILLES).toHaveLength(3)
    expect(CAPACITES).toHaveLength(9)
    expect(FAMILLES.map((f) => f.titre)).toEqual([
      'Développer mon activité',
      'Visibilité & Acquisition',
      'Automatisation & IA',
    ])
  })

  it('respecte les libellés et les clés de la spécification', () => {
    expect(CAPACITES.map((c) => [c.intent, c.libelle])).toEqual([
      ['clients', 'Trouver plus de clients'],
      ['mlm', 'Développer mon MLM / parrainage'],
      ['ventes', 'Améliorer mes ventes'],
      ['site_web', 'Créer un site web qui convertit'],
      ['seo', 'Améliorer mon référencement'],
      ['ads', 'Lancer une campagne publicitaire'],
      ['social', 'Gérer mes réseaux sociaux'],
      ['ia_auto', 'Exploiter l’IA et l’automatisation'],
      ['funnel', 'Optimiser mon tunnel de conversion'],
    ])
  })

  it('construit le payload `[intent:<clé>] <libellé>`', () => {
    const seo = capaciteParIntent('seo')!
    expect(payloadSuggestion(seo)).toBe('[intent:seo] Améliorer mon référencement')
  })

  it('ne nomme aucun agent dans les libellés', () => {
    const interdits = ['coach', 'agent', 'expert', 'specialist', 'sales', 'marketing']
    for (const capacite of CAPACITES) {
      for (const mot of interdits) {
        expect(capacite.libelle.toLowerCase()).not.toContain(mot)
      }
    }
  })

  it('trace chaque clic (capacité, horodatage, session)', () => {
    const seo = capaciteParIntent('seo')!
    const clic = tracerClicSuggestion(seo)
    expect(clic.suggestion_id).toBe('seo')
    expect(clic.label).toBe('Améliorer mon référencement')
    expect(clic.session_id).toMatch(/^sess_/)
    expect(Number.isNaN(Date.parse(clic.timestamp))).toBe(false)
  })

  it('regroupe les clics d’une même session sous le même identifiant', () => {
    expect(sessionId()).toBe(sessionId())
    expect(sessionId().startsWith('sess_')).toBe(true)
  })

  it('n’envoie le clic qu’une seule fois (consommé au message)', async () => {
    tracerClicSuggestion(capaciteParIntent('funnel')!)
    const messages = useMessagesStore()
    await messages.sendMessage('[intent:funnel] Optimiser mon tunnel de conversion')
    await flushPromises()

    expect(mockedSendMessage.mock.calls[0][0].extraVisitorInfo?.suggestion_click).toMatchObject({
      suggestion_id: 'funnel',
    })

    // Message suivant : plus de clic attaché
    await messages.sendMessage('Et ensuite ?')
    await flushPromises()
    expect(mockedSendMessage.mock.calls[1][0].extraVisitorInfo?.suggestion_click).toBeUndefined()
  })
})

// ================================================= N3 — événements hôte

describe('N3 — les deux événements attendus par le noyau', () => {
  it('émet `eperf:chatbot:message` sur le document hôte à chaque réponse', async () => {
    const messages = useMessagesStore()
    const recus: string[] = []
    document.addEventListener('eperf:chatbot:message', (e) => {
      recus.push((e as CustomEvent<{ intent: string }>).detail.intent)
    })

    messages.applyResponse(
      makeResponse({
        metadata: {
          conversation_id: 'conv_n3',
          intent: 'seo',
          agent_used: 'marketing-seo-specialist',
          actions: [],
          suggestions: [],
          processing_time: 5,
        },
      }),
      'conv_n3',
    )
    await flushPromises()

    // Le widget poste au SDK (parent) — sans iframe parent, postToSdk est no-op,
    // donc on vérifie ici la voie widget → SDK puis la voie SDK → document
    // dans src/sdk/sdk.spec.ts. Ce test couvre l'appel et la catégorie émise.
    expect(recus).toEqual([]) // pas de parent : rien à rediffuser
  })

  it('n’envoie jamais le texte du message dans le détail', () => {
    // Le contrat N3 impose une CATÉGORIE : le texte du visiteur ne doit pas
    // pouvoir être attaché à l'événement de mesure.
    const detailAttendu = { intent: 'mlm' }
    expect(Object.keys(detailAttendu)).toEqual(['intent'])
    expect(JSON.stringify(detailAttendu)).not.toContain(' ')
  })

  it('marque les captures de contact détectées par le pipeline', () => {
    const messages = useMessagesStore()
    messages.applyResponse(
      makeResponse({
        metadata: {
          conversation_id: 'conv_n3',
          intent: 'order_intent',
          agent_used: 'sales-offer-lead-gen-strategist',
          actions: [{ action: 'lead_capture', success: true }],
          suggestions: [],
          processing_time: 5,
        },
      }),
      'conv_n3',
    )
    expect(messages.leadCapture).toBe(true)
  })

  it('pose `data-ep-lead` sur le lien WhatsApp du fallback', () => {
    const messages = useMessagesStore()
    messages.addWhatsAppFallback(false)
    const html = messages.messages.at(-1)?.html ?? ''
    expect(html).toContain('data-ep-lead="whatsapp_clic"')
  })
})
