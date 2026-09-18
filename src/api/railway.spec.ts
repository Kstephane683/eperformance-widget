/**
 * Tests de la couche API (tâche 6.3-BIS A.1/A.8) — module RÉEL, `fetch` mocké.
 *
 * Vérifie ce que le store ne peut pas garantir : la forme exacte du corps
 * envoyé à `POST /api/chatbot/message` — image posée sur le dernier message,
 * clic de suggestion dans `visitor_info`, absence d'`onclick` et de HTML.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/api/railway'

const IMAGE = {
  data: 'QUJD',
  media_type: 'image/png',
  detail: 'auto' as const,
  name: 'visuel.png',
}

function reponseOk() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ text: 'ok', html: null, files: null, metadata: null }),
  } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(reponseOk())
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function corpsEnvoye(): Record<string, unknown> {
  const init = fetchMock.mock.calls[0][1] as RequestInit
  return JSON.parse(String(init.body))
}

describe('sendMessage — corps réellement transmis', () => {
  it('pose l’image sur le DERNIER message', async () => {
    await sendMessage(
      {
        messages: [
          { role: 'user', text: 'Bonjour' },
          { role: 'ai', text: 'Bonjour !' },
          { role: 'user', text: 'Regarde ce visuel' },
        ],
        conversationId: 'conv_1',
        image: IMAGE,
      },
      'https://api.exemple',
      'eperformance_vitrine',
    )

    const corps = corpsEnvoye() as { messages: Array<Record<string, unknown>> }
    expect(corps.messages[0].image).toBeUndefined()
    expect(corps.messages[1].image).toBeUndefined()
    expect(corps.messages[2].image).toEqual(IMAGE)
  })

  it('n’ajoute aucun champ image sans pièce jointe', async () => {
    await sendMessage(
      { messages: [{ role: 'user', text: 'Bonjour' }], conversationId: 'conv_1' },
      'https://api.exemple',
      'eperformance_vitrine',
    )
    const corps = corpsEnvoye() as { messages: Array<Record<string, unknown>> }
    expect(corps.messages[0]).toEqual({ role: 'user', text: 'Bonjour' })
  })

  it('transmet le clic de suggestion dans visitor_info', async () => {
    const clic = {
      suggestion_id: 'clients',
      intent: 'clients',
      label: 'Trouver plus de clients',
      timestamp: '2026-09-18T10:00:00.000Z',
      session_id: 'sess_abc',
    }
    await sendMessage(
      { messages: [{ role: 'user', text: 'x' }], conversationId: 'conv_1', extraVisitorInfo: { suggestion_click: clic } },
      'https://api.exemple',
      'eperformance_vitrine',
    )
    const corps = corpsEnvoye() as { visitor_info: Record<string, unknown> }
    expect(corps.visitor_info.suggestion_click).toEqual(clic)
    expect(corps.visitor_info.page_url).toBeDefined()
  })

  it('envoie le payload `[intent:…]` tel quel (le préfixe est retiré côté serveur)', async () => {
    await sendMessage(
      {
        messages: [{ role: 'user', text: '[intent:seo] Améliorer mon référencement' }],
        conversationId: 'conv_1',
      },
      'https://api.exemple',
      'eperformance_vitrine',
    )
    const corps = corpsEnvoye() as { messages: Array<{ text: string }> }
    expect(corps.messages.at(-1)?.text).toBe('[intent:seo] Améliorer mon référencement')
  })

  it('appelle bien POST /api/chatbot/message', async () => {
    await sendMessage(
      { messages: [{ role: 'user', text: 'x' }], conversationId: 'conv_1' },
      'https://api.exemple',
      'eperformance_vitrine',
    )
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.exemple/api/chatbot/message')
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST')
  })
})
