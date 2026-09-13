/**
 * Tests stores — contrat V2 (/home/ballo/OX6A/CONTRAT-INTERFACE-V2.md)
 * L'API Railway est mockée ; on teste la logique store : session,
 * persistance, mémoire (historique complet envoyé), normalisation rôles.
 */
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConversationNotFoundError, getConversation, sendMessage } from '@/api/railway'
import type { ChatbotMessageResponse } from '@/types/api'
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
})
