/**
 * Tests stores — contrat V2 (/home/ballo/OX6A/CONTRAT-INTERFACE-V2.md)
 * L'API Railway est mockée ; on teste la logique store : session,
 * persistance, mémoire (historique complet envoyé), normalisation rôles.
 */
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConversationNotFoundError, getConversation, sendMessage } from '@/api/railway'
import type { ChatbotMessageResponse } from '@/types/api'
import { htmlToText, renderMarkdown, sanitizeMessageHtml } from '@/helpers/sanitize'
import { useConfigStore } from '@/stores/config'
import { useConversationStore } from '@/stores/conversation'
import { useMessagesStore } from '@/stores/messages'

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
    text: 'Réponse IA',
    html: null,
    files: null,
    metadata: {
      conversation_id: 'conv_serveur_123',
      intent: 'greeting',
      agent_used: 'sales-discovery-coach',
      actions: [],
      suggestions: ['Faire un diagnostic', 'Voir nos services'],
      processing_time: 800,
    },
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.clearAllMocks()
})

describe('config store', () => {
  it('a les valeurs par défaut ePerformance', () => {
    const config = useConfigStore()
    expect(config.config.siteId).toBe('eperformance_vitrine')
    expect(config.config.locale).toBe('fr')
  })

  it('applique les overrides du SDK', () => {
    const config = useConfigStore()
    config.configure({ color: '#ff0000', siteId: 'site_client_x' })
    expect(config.config.color).toBe('#ff0000')
    expect(config.config.siteId).toBe('site_client_x')
    expect(config.config.locale).toBe('fr')
  })
})

describe('conversation store', () => {
  it('ensureConversation crée et persiste un ID client', () => {
    const conversation = useConversationStore()
    const id = conversation.ensureConversation()
    expect(id).toMatch(/^conv_/)
    expect(localStorage.getItem('eperf_conversation_id')).toBe(id)
    // 2e appel → même ID (stabilité de session)
    expect(conversation.ensureConversation()).toBe(id)
  })

  it('setServerId remplace l ID client par l ID serveur (contrat V2)', () => {
    const conversation = useConversationStore()
    conversation.ensureConversation()
    conversation.setServerId('conv_serveur_123')
    expect(conversation.conversationId).toBe('conv_serveur_123')
    expect(localStorage.getItem('eperf_conversation_id')).toBe('conv_serveur_123')
  })

  it('setServerId ignore les valeurs vides', () => {
    const conversation = useConversationStore()
    const id = conversation.ensureConversation()
    conversation.setServerId(null)
    expect(conversation.conversationId).toBe(id)
  })

  it('restore hydrate depuis GET /conversation et retourne true', async () => {
    mockedGetConversation.mockResolvedValue({
      conversation_id: 'conv_serveur_123',
      site_id: 'eperformance_vitrine',
      status: 'active',
      created_at: null,
      updated_at: null,
      messages: [
        { role: 'user', content: 'Bonjour', intent: null, agent_used: null, actions: null, suggestions: null, created_at: null },
        { role: 'assistant', content: 'Salut !', intent: 'greeting', agent_used: 'sales-discovery-coach', actions: [], suggestions: null, created_at: null },
      ],
    })
    const conversation = useConversationStore()
    conversation.setServerId('conv_serveur_123')

    const ok = await conversation.restore()

    expect(ok).toBe(true)
    expect(mockedGetConversation).toHaveBeenCalledWith('conv_serveur_123', expect.any(String))
    const messages = useMessagesStore()
    expect(messages.messages).toHaveLength(2)
    // Normalisation rôles DB → widget : 'assistant' → 'agent'
    expect(messages.messages[1].role).toBe('agent')
    expect(messages.messages[1].agent_used).toBe('sales-discovery-coach')
  })

  it('restore sur 404 (ConversationNotFoundError) reset la session', async () => {
    mockedGetConversation.mockRejectedValue(new ConversationNotFoundError())
    const conversation = useConversationStore()
    conversation.setServerId('conv_perdue')

    const ok = await conversation.restore()

    expect(ok).toBe(false)
    expect(conversation.conversationId).toBeNull()
    expect(localStorage.getItem('eperf_conversation_id')).toBeNull()
  })

  it('restore sans conversation ne fait aucun appel', async () => {
    const conversation = useConversationStore()
    const ok = await conversation.restore()
    expect(ok).toBe(false)
    expect(mockedGetConversation).not.toHaveBeenCalled()
  })
})

describe('messages store', () => {
  it('sendMessage envoie TOUT l historique avec roles backend (user|ai)', async () => {
    mockedSendMessage.mockResolvedValue(makeResponse())
    const messages = useMessagesStore()

    // 1er échange
    messages.addLocal('agent', 'Bonjour ! Je suis Aminata', null, 'sales-discovery-coach')
    await messages.sendMessage('Je veux un diagnostic')

    expect(mockedSendMessage).toHaveBeenCalledTimes(1)
    const payload = mockedSendMessage.mock.calls[0][0]
    const roles = payload.messages.map((m) => m.role)
    // 'agent' interne → 'ai' backend (format Deep Chat, pattern ^(user|ai)$)
    expect(roles).toEqual(['ai', 'user'])
    // le DERNIER message est le message courant
    expect(payload.messages[payload.messages.length - 1].text).toBe('Je veux un diagnostic')
    expect(payload.conversationId).toMatch(/^conv_/)
  })

  it('sendMessage applique la réponse : ID serveur, agent, quick replies', async () => {
    mockedSendMessage.mockResolvedValue(makeResponse())
    const messages = useMessagesStore()
    const conversation = useConversationStore()
    const clientId = conversation.ensureConversation()

    await messages.sendMessage('Bonjour')

    expect(conversation.conversationId).toBe('conv_serveur_123')
    expect(localStorage.getItem('eperf_conversation_id')).toBe('conv_serveur_123')
    expect(messages.messages.at(-1)?.role).toBe('agent')
    expect(messages.messages.at(-1)?.agent_used).toBe('sales-discovery-coach')
    expect(messages.quickReplies).toEqual(['Faire un diagnostic', 'Voir nos services'])
    expect(messages.isTyping).toBe(false)
    expect(clientId).not.toBe('conv_serveur_123')
  })

  it('sendMessage ignore les messages vides et les doubles envois', async () => {
    const messages = useMessagesStore()
    await messages.sendMessage('   ')
    expect(mockedSendMessage).not.toHaveBeenCalled()

    mockedSendMessage.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(makeResponse()), 50)),
    )
    const first = messages.sendMessage('Salut')
    await messages.sendMessage('Salut bis')
    await first
    expect(mockedSendMessage).toHaveBeenCalledTimes(1)
  })

  it('en cas d erreur réseau : lastError renseigné, isTyping faux', async () => {
    mockedSendMessage.mockRejectedValue(new Error('HTTP 500'))
    const messages = useMessagesStore()

    await expect(messages.sendMessage('Bonjour')).rejects.toThrow('HTTP 500')

    expect(messages.lastError).toBe('HTTP 500')
    expect(messages.isTyping).toBe(false)
    expect(messages.isSending).toBe(false)
  })

  it('reponse sans metadata.suggestions vide les quick replies', async () => {
    mockedSendMessage.mockResolvedValue(
      makeResponse({ metadata: null }),
    )
    const messages = useMessagesStore()
    messages.quickReplies = ['Ancien bouton']

    await messages.sendMessage('Bonjour')

    expect(messages.quickReplies).toEqual([])
    expect(messages.messages.at(-1)?.role).toBe('agent')
  })

  it('sendQuickReply envoie la valeur comme message user', async () => {
    mockedSendMessage.mockResolvedValue(makeResponse())
    const messages = useMessagesStore()

    await messages.sendQuickReply('Faire un diagnostic')

    const payload = mockedSendMessage.mock.calls[0][0]
    expect(payload.messages.at(-1)?.text).toBe('Faire un diagnostic')
  })

  it('erreur réseau → fallback WhatsApp avec lien wa.me (héritage v6.0)', async () => {
    mockedSendMessage.mockRejectedValue(new Error('Failed to fetch'))
    const messages = useMessagesStore()

    await expect(messages.sendMessage('Bonjour')).rejects.toThrow()

    const fallback = messages.messages.at(-1)
    expect(fallback?.role).toBe('agent')
    expect(fallback?.content).toContain('WhatsApp')
    expect(fallback?.html).toContain('https://wa.me/2250151170666')
    expect(messages.quickReplies).toEqual([])
  })

  it('timeout (AbortError) → fallback WhatsApp mentionne le délai', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError')
    mockedSendMessage.mockRejectedValue(abortError)
    const messages = useMessagesStore()

    await expect(messages.sendMessage('Bonjour')).rejects.toThrow()

    expect(messages.messages.at(-1)?.content).toContain('délai de réponse est dépassé')
  })

  it('retryLast retire fallback + doublon user et renvoie exactement une fois', async () => {
    mockedSendMessage.mockRejectedValueOnce(new Error('Failed to fetch'))
    const messages = useMessagesStore()
    await expect(messages.sendMessage('Mon message perdu')).rejects.toThrow()
    expect(messages.failedContent).toBe('Mon message perdu')

    mockedSendMessage.mockResolvedValueOnce(makeResponse())
    await messages.retryLast()

    const userMsgs = messages.messages.filter(
      (m) => m.role === 'user' && m.content === 'Mon message perdu',
    )
    expect(userMsgs).toHaveLength(1) // pas de doublon dans l'historique
    expect(messages.failedContent).toBeNull()
    expect(messages.messages.at(-1)?.content).toBe('Réponse IA') // pas le fallback
  })
})

describe('sanitize (contrat V2 §Normalisations)', () => {
  it('retire les boutons backend et leurs onclick, garde le texte', () => {
    const html =
      '<div style="line-height: 1.6;"><p>Bonjour ! Je suis Aminata.</p>' +
      '<button onclick="window.deepChatSendMessage(\'Diagnostic\')">Diagnostic</button></div>'

    const clean = sanitizeMessageHtml(html)

    expect(clean).toContain('Bonjour ! Je suis Aminata.')
    expect(clean).not.toContain('<button')
    expect(clean).not.toContain('deepChatSendMessage')
    expect(clean).not.toContain('onclick')
  })

  it('htmlToText extrait le texte brut après sanitization', () => {
    const html = '<div><p>Tu es dans quel secteur ?</p><script>alert(1)</script></div>'
    expect(htmlToText(html)).toBe('Tu es dans quel secteur ?')
  })

  it('htmlToText ne fuit PAS le texte des boutons backend (suggestions = quick replies natifs)', () => {
    const html =
      '<div style="line-height:1.6">Bonjour ! Je suis Aminata.</div>' +
      '<div style="display:flex"><button onclick="window.deepChatSendMessage(\'Faire un diagnostic\')">Faire un diagnostic</button>' +
      '<button>Voir nos services</button></div>'
    const text = htmlToText(html)
    expect(text).toBe('Bonjour ! Je suis Aminata.')
    expect(text).not.toContain('Faire un diagnostic')
    expect(text).not.toContain('Voir nos services')
  })

  it('renderMarkdown convertit gras/italique/code en HTML sûr', () => {
    const out = renderMarkdown('Voici **un point clé** et *une nuance* et `du code`\nSuite')
    expect(out).toContain('<strong>un point clé</strong>')
    expect(out).toContain('<em>une nuance</em>')
    expect(out).toContain('<code>du code</code>')
    expect(out).toContain('<p>Suite</p>')
    // Pas de ** résiduel
    expect(out).not.toContain('**')
  })

  it('renderMarkdown échappe le HTML injecté dans le texte', () => {
    const out = renderMarkdown('Texte avec <script>alert(1)</script> et **gras**')
    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;script&gt;')
    expect(out).toContain('<strong>gras</strong>')
  })

  it('renderMarkdown convertit les listes ordonnées et à puces', () => {
    const out = renderMarkdown('Intro :\n1. Premier point\n2. Deuxième point\n- Puce A\n- Puce B')
    expect(out).toContain('<ol>')
    expect(out).toContain('<li>Premier point</li>')
    expect(out).toContain('<li>Deuxième point</li>')
    expect(out).toContain('<ul>')
    expect(out).toContain('<li>Puce A</li>')
    expect(out).toContain('<li>Puce B</li>')
    expect(out).toContain('<p>Intro :</p>')
  })

  it('renderMarkdown convertit les liens https mais pas javascript:', () => {
    const ok = renderMarkdown('[Nos offres](https://eperformance.pro/offres)')
    expect(ok).toContain('<a href="https://eperformance.pro/offres"')
    expect(ok).toContain('target="_blank"')

    const unsafe = renderMarkdown('[clic](javascript:alert(1))')
    expect(unsafe).not.toContain('<a ')
    expect(unsafe).toContain('javascript:alert(1)') // reste du texte brut
  })
})
