/**
 * Bridge widget ↔ SDK (site hôte) — adapté de IframeEventHelper.js (Chatwoot).
 *
 * Le SDK (injecté sur le site client) pilote la visibilité de l'iframe et
 * notifie le widget via postMessage. Protocole :
 *   SDK → widget : { event: 'open' | 'close' | 'identify', ... }
 *   widget → SDK : { event: 'ready' } au montage
 *
 * Format message : `eperformance-widget:${JSON.stringify(...)}` (pattern Chatwoot)
 */

import type { WidgetIdentity } from '@/stores/conversation'

export const MESSAGE_PREFIX = 'eperformance-widget:'

export type SdkEvent =
  | { event: 'open' }
  | { event: 'close' }
  | { event: 'identify'; userId: WidgetIdentity['userId']; userData: Record<string, unknown> }

export interface SdkBridgeHandlers {
  onOpen: () => void
  onClose: () => void
  onIdentify: (userId: WidgetIdentity['userId'], userData: Record<string, unknown>) => void
}

/** Envoyer un événement au parent (SDK) — no-op si pas d'iframe parent */
export function postToSdk(event: Record<string, unknown>) {
  if (window.parent === window) return
  window.parent.postMessage(`${MESSAGE_PREFIX}${JSON.stringify(event)}`, '*')
}

export function notifyReady() {
  postToSdk({ event: 'ready' })
}

/** Écouter les événements du SDK — retourne la fonction de cleanup */
export function initSdkBridge(handlers: SdkBridgeHandlers): () => void {
  function onMessage(e: MessageEvent) {
    if (typeof e.data !== 'string' || !e.data.startsWith(MESSAGE_PREFIX)) {
      return
    }
    try {
      const message = JSON.parse(e.data.slice(MESSAGE_PREFIX.length)) as SdkEvent
      switch (message.event) {
        case 'open':
          handlers.onOpen()
          break
        case 'close':
          handlers.onClose()
          break
        case 'identify':
          handlers.onIdentify(message.userId, message.userData ?? {})
          break
      }
    } catch {
      // Message non-JSON ou étranger — ignoré silencieusement
    }
  }

  window.addEventListener('message', onMessage)
  return () => window.removeEventListener('message', onMessage)
}
