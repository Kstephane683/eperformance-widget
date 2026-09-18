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

/**
 * Gabarit de l'écran HÔTE. L'iframe fait 400 px de large sur un desktop :
 * une requête média mesurée dans l'iframe dirait « mobile » à tort. C'est
 * donc le SDK — qui voit la vraie fenêtre — qui tranche et le transmet.
 */
export type Viewport = 'mobile' | 'desktop'

export type SdkEvent =
  | { event: 'open'; theme?: 'light' | 'dark'; viewport?: Viewport }
  | { event: 'close' }
  | { event: 'theme'; theme: 'light' | 'dark' }
  | { event: 'viewport'; viewport: Viewport }
  | { event: 'identify'; userId: WidgetIdentity['userId']; userData: Record<string, unknown> }

export interface SdkBridgeHandlers {
  onOpen: (theme?: 'light' | 'dark') => void
  onClose: () => void
  onIdentify: (userId: WidgetIdentity['userId'], userData: Record<string, unknown>) => void
  /** Gabarit de l'écran hôte : au chargement puis à chaque franchissement */
  onViewport?: (viewport: Viewport) => void
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
        case 'open': {
          const ouverture = message as { theme?: 'light' | 'dark'; viewport?: Viewport }
          handlers.onOpen(ouverture.theme)
          if (ouverture.viewport) handlers.onViewport?.(ouverture.viewport)
          break
        }
        case 'theme':
          // Le site a basculé clair/sombre : l'iframe suit (cohérence design)
          document.documentElement.setAttribute('data-theme', message.theme)
          break
        case 'viewport':
          handlers.onViewport?.(message.viewport)
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
