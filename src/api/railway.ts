/**
 * Client API Railway — contrat V2 (source: /home/ballo/OX6A/CONTRAT-INTERFACE-V2.md)
 *
 * Points contractuels :
 * - POST /message : on envoie TOUT l'historique (le backend prend [-1] comme
 *   message courant et [:-1] comme contexte mémoire)
 * - GET /conversation/{id} : 404 = conversation inconnue → session vierge
 * - Metadata toujours présente sauf fallback erreur (metadata.error)
 */

import type {
  BackendMessage,
  ChatbotMessageRequest,
  ChatbotMessageResponse,
  ConversationHistoryResponse,
} from '@/types/api'

export class ConversationNotFoundError extends Error {
  constructor() {
    super('Conversation not found')
    this.name = 'ConversationNotFoundError'
  }
}

const MESSAGE_TIMEOUT_MS = 30_000

export interface SendMessagePayload {
  /** Historique complet du store — le DERNIER élément est le message courant (role 'user') */
  messages: BackendMessage[]
  conversationId: string
}

function visitorInfo() {
  return {
    page_url: window.location.href,
    referrer: document.referrer || undefined,
  }
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), MESSAGE_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function sendMessage(
  payload: SendMessagePayload,
  apiBase: string,
  siteId: string,
): Promise<ChatbotMessageResponse> {
  const body: ChatbotMessageRequest = {
    messages: payload.messages,
    site_id: siteId,
    conversation_id: payload.conversationId,
    visitor_info: visitorInfo(),
  }

  const res = await fetchWithTimeout(`${apiBase}/api/chatbot/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return (await res.json()) as ChatbotMessageResponse
}

export async function getConversation(
  conversationId: string,
  apiBase: string,
): Promise<ConversationHistoryResponse> {
  const res = await fetchWithTimeout(
    `${apiBase}/api/chatbot/conversation/${encodeURIComponent(conversationId)}`,
    { method: 'GET' },
  )

  if (res.status === 404) {
    throw new ConversationNotFoundError()
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return (await res.json()) as ConversationHistoryResponse
}
