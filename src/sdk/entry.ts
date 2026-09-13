/**
 * SDK d'injection ePerformance — adapté de IFrameHelper.js + bubbleHelpers.js
 * (Chatwoot), buildé en IIFE autonome (< 10 KB), zéro dépendance.
 *
 * Intégration site hôte :
 * ```
 * <script>
 *   window.ePerformanceConfig = {
 *     widgetUrl: 'https://cdn.exemple.com/widget/',   // où le bundle widget est hébergé
 *     apiUrl: 'https://web-production-4ab53.up.railway.app',
 *     siteId: 'eperformance_vitrine',
 *     position: 'right',
 *   };
 * </script>
 * <script src="https://cdn.exemple.com/eperformance-sdk.js" defer></script>
 * ```
 *
 * API publique : window.ePerformance.open() / close() / toggle() /
 * identify(userId, userData) / on(event, handler)
 */

// ============================================================
// Types + config
// ============================================================

interface SdkConfig {
  widgetUrl: string
  apiUrl: string
  siteId: string
  color: string
  position: 'left' | 'right'
}

type SdkListener = (payload?: Record<string, unknown>) => void

declare global {
  interface Window {
    ePerformanceConfig?: Partial<SdkConfig>
    ePerformance?: {
      open: () => void
      close: () => void
      toggle: () => void
      identify: (userId: number | string | null, userData?: Record<string, unknown>) => void
      on: (event: 'open' | 'close', listener: SdkListener) => void
    }
  }
}

const DEFAULTS: SdkConfig = {
  widgetUrl: 'http://localhost:4173',
  apiUrl: 'https://web-production-4ab53.up.railway.app',
  siteId: 'eperformance_vitrine',
  color: '#c9a96e',
  position: 'right',
}

const MESSAGE_PREFIX = 'eperformance-widget:'
const BASE_Z_INDEX = 2147483000
const FRAME_ID = 'eperformance-widget-frame'
const HOLDER_ID = 'eperformance-widget-holder'
const BUBBLE_ID = 'eperformance-widget-bubble'
const TEASER_ID = 'eperformance-widget-teaser'
const OPEN_KEY = 'eperf_widget_open'
const TEASER_KEY = 'eperf_teaser_done'
const MOBILE_BREAKPOINT = 668
const TEASER_DELAY_MS = 20_000

// ============================================================
// CSS embarqué (pattern Chatwoot loadCSS — pas de fichier externe)
// ============================================================

const SDK_CSS = `
#${HOLDER_ID} {
  position: fixed !important;
  bottom: 88px;
  width: 400px;
  max-width: calc(100vw - 40px);
  height: min(650px, calc(100dvh - 110px));
  z-index: ${BASE_Z_INDEX} !important;
  opacity: 0;
  visibility: hidden;
  transform: translateY(24px) scale(0.98);
  transition: opacity 0.25s ease, transform 0.25s ease, visibility 0.25s;
  pointer-events: none;
}
#${HOLDER_ID}.ep-holder--right { right: 20px; }
#${HOLDER_ID}.ep-holder--left { left: 20px; }
#${HOLDER_ID}.ep-holder--visible {
  opacity: 1;
  visibility: visible;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}
#${FRAME_ID} {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
}
#${BUBBLE_ID} {
  position: fixed !important;
  bottom: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  z-index: ${BASE_Z_INDEX + 1} !important;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35), 0 0 0 6px rgba(201, 169, 110, 0.15);
  transition: transform 0.15s ease;
  color: #0a0a0e;
}
#${BUBBLE_ID}:hover { transform: scale(1.06); }
#${BUBBLE_ID}.ep-bubble--right { right: 20px; }
#${BUBBLE_ID}.ep-bubble--left { left: 20px; }
@media (max-width: ${MOBILE_BREAKPOINT}px) {
  #${HOLDER_ID} {
    right: 0 !important;
    left: 0 !important;
    top: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    /* 100% (viewport exact) plutôt que 100dvh: dvh inclut les barres
       rétractables du navigateur → débordement haut (header coupé) */
    height: 100% !important;
    max-width: 100%;
    border-radius: 0;
  }
  #${FRAME_ID} { border-radius: 0; }
  #${BUBBLE_ID}.ep-bubble--right, #${BUBBLE_ID}.ep-bubble--left { right: 16px; }
  /* Widget ouvert en plein écran : la bubble-croix masquerait l'input —
     le bouton fermer est dans le header du widget */
  #${BUBBLE_ID}.ep-bubble--open { display: none !important; }
  #${TEASER_ID} { right: 16px; bottom: 88px; }
}

/* Accessibilité : réduire les animations si demandé par le système */
@media (prefers-reduced-motion: reduce) {
  #${HOLDER_ID}, #${BUBBLE_ID}, #${TEASER_ID} {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Teaser proactif (pattern Intercom/Drift — héritage v6.0) */
#${TEASER_ID} {
  position: fixed !important;
  bottom: 88px;
  right: 20px;
  z-index: ${BASE_Z_INDEX + 2} !important;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 280px;
  padding: 12px 14px;
  border-radius: 14px 14px 4px 14px;
  background: #14141a;
  color: #edeae3;
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.45;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(201, 169, 110, 0.25);
  cursor: pointer;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.3s ease, transform 0.3s ease;
}
#${TEASER_ID}.ep-teaser--visible {
  opacity: 1;
  transform: translateY(0);
}
#${TEASER_ID} button {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: rgba(201, 169, 110, 0.15);
  color: #c9a96e;
  font-size: 11px;
  cursor: pointer;
}
`

// ============================================================
// Icônes (SVG inline — chat / croix)
// ============================================================

const CHAT_ICON = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3C6.9 3 2.8 6.6 2.8 11c0 2.1 0.9 4 2.4 5.4-0.2 1.2-0.8 2.4-1.7 3.2-0.3 0.3 0 0.8 0.4 0.7 1.9-0.3 3.5-1 4.6-1.8 1.1 0.4 2.3 0.6 3.5 0.6 5.1 0 9.2-3.6 9.2-8S17.1 3 12 3z" fill="currentColor"/></svg>`

const CLOSE_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`

// ============================================================
// État interne du SDK
// ============================================================

let config: SdkConfig = { ...DEFAULTS }
let isOpen = false
let keyboardUpdate: (() => void) | null = null
let keyboardForceUpdate: (() => void) | null = null
const listeners: Record<'open' | 'close', SdkListener[]> = { open: [], close: [] }

// ============================================================
// postMessage widget ↔ SDK
// ============================================================

function postToWidget(event: Record<string, unknown>) {
  const frame = document.getElementById(FRAME_ID) as HTMLIFrameElement | null
  frame?.contentWindow?.postMessage(`${MESSAGE_PREFIX}${JSON.stringify(event)}`, '*')
}

function onWidgetMessage(e: MessageEvent) {
  if (typeof e.data !== 'string' || !e.data.startsWith(MESSAGE_PREFIX)) {
    return
  }
  try {
    const message = JSON.parse(e.data.slice(MESSAGE_PREFIX.length)) as { event: string }
    if (message.event === 'close' && isOpen) {
      close()
    }
    // Widget prêt après un refresh : resynchroniser son état avec celui du SDK
    // (l'open() initial peut arriver avant le montage du bridge dans l'iframe)
    if (message.event === 'ready') {
      postToWidget({ event: isOpen ? 'open' : 'close' })
    }
    // Le widget signale le focus/blur de son input : fiabilise le timing iOS
    // (le visualViewport resize peut arriver tard pendant l'animation clavier)
    if (message.event === 'input-focus' && isOpen) {
      keyboardUpdate?.()
      keyboardForceUpdate?.()
    }
  } catch {
    // Ignoré
  }
}

// ============================================================
// DOM : iframe + bubble
// ============================================================

function buildFrameSrc(): string {
  const url = new URL(config.widgetUrl, window.location.href)
  url.searchParams.set('apiUrl', config.apiUrl)
  url.searchParams.set('siteId', config.siteId)
  url.searchParams.set('color', config.color)
  return url.toString()
}

function createFrame(): void {
  if (document.getElementById(FRAME_ID)) return

  const holder = document.createElement('div')
  holder.id = HOLDER_ID
  holder.className = `ep-holder--${config.position}`
  holder.setAttribute('aria-hidden', 'true')

  const iframe = document.createElement('iframe')
  iframe.id = FRAME_ID
  iframe.src = buildFrameSrc()
  iframe.title = 'Assistant ePerformance'
  iframe.allow = 'clipboard-write'

  holder.appendChild(iframe)
  document.body.appendChild(holder)
}

function createBubble(): void {
  if (document.getElementById(BUBBLE_ID)) return

  const bubble = document.createElement('button')
  bubble.id = BUBBLE_ID
  bubble.type = 'button'
  bubble.className = `ep-bubble--${config.position}`
  bubble.setAttribute('aria-label', 'Ouvrir le chat')
  bubble.style.background = `linear-gradient(135deg, ${config.color} 0%, #e2c07a 100%)`
  bubble.innerHTML = CHAT_ICON
  bubble.addEventListener('click', toggle)

  document.body.appendChild(bubble)
}

function setIcon(icon: string) {
  const bubble = document.getElementById(BUBBLE_ID)
  if (bubble) bubble.innerHTML = icon
}

// ============================================================
// Open / close
// ============================================================

function open(): void {
  if (isOpen) return
  isOpen = true
  dismissTeaser()
  sessionStorage.setItem(OPEN_KEY, '1')
  document.getElementById(HOLDER_ID)?.classList.add('ep-holder--visible')
  document.getElementById(HOLDER_ID)?.removeAttribute('aria-hidden')
  document.getElementById(BUBBLE_ID)?.classList.add('ep-bubble--open')
  setIcon(CLOSE_ICON)
  postToWidget({ event: 'open' })
  keyboardUpdate?.()
  listeners.open.forEach((fn) => fn())
}

function close(): void {
  if (!isOpen) return
  isOpen = false
  sessionStorage.removeItem(OPEN_KEY)
  document.getElementById(HOLDER_ID)?.classList.remove('ep-holder--visible')
  document.getElementById(HOLDER_ID)?.setAttribute('aria-hidden', 'true')
  document.getElementById(BUBBLE_ID)?.classList.remove('ep-bubble--open')
  setIcon(CHAT_ICON)
  postToWidget({ event: 'close' })
  listeners.close.forEach((fn) => fn())
}

function toggle(): void {
  isOpen ? close() : open()
}

// ============================================================
// Fix clavier mobile (iOS : le clavier ne redimensionne pas le viewport
// et scrolle la page hôte de force → éléments fixed instables).
// Stratégie : ancrer le holder par le HAUT (top = début de la zone
// visible) — stable pendant la frappe — et re-vérifier au focus input.
// ============================================================

function initKeyboardFix(): void {
  const vv = window.visualViewport
  if (!vv) return
  const update = () => {
    const el = document.getElementById(HOLDER_ID)
    if (!el || !isOpen) return
    // Fix mobile uniquement — le desktop garde son ancrage bas fixe
    if (!window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches) return
    const keyboardHeight = window.innerHeight - vv.height
    if (keyboardHeight > 150 || vv.offsetTop > 4) {
      // Zone visible réduite (clavier) ou page hôte décalée par iOS :
      // ancrage par le haut = la seule coordonnée stable
      el.style.setProperty('top', `${Math.round(vv.offsetTop)}px`, 'important')
      el.style.setProperty('height', `${Math.round(vv.height)}px`, 'important')
      el.style.setProperty('bottom', 'auto', 'important')
    } else {
      el.style.removeProperty('top')
      el.style.removeProperty('height')
      el.style.removeProperty('bottom')
    }
  }
  vv.addEventListener('resize', update)
  vv.addEventListener('scroll', update)
  window.addEventListener('resize', update)
  // L'animation du clavier iOS étale ses changements ~400ms : re-vérifier
  const updateAfterKeyboard = () => {
    setTimeout(update, 350)
    setTimeout(update, 800)
  }
  vv.addEventListener('resize', updateAfterKeyboard)
  keyboardUpdate = update
  keyboardForceUpdate = updateAfterKeyboard
}

// ============================================================
// Bootstrap
// ============================================================

function loadCss(): void {
  const style = document.createElement('style')
  style.textContent = SDK_CSS
  document.head.appendChild(style)
}

function exposeApi(): void {
  window.ePerformance = {
    open,
    close,
    toggle,
    identify: (userId, userData = {}) => postToWidget({ event: 'identify', userId, userData }),
    on: (event, listener) => {
      if (event === 'open' || event === 'close') listeners[event].push(listener)
    },
  }
}

// ============================================================
// Teaser proactif + raccourci Échap + persistance état ouvert
// ============================================================

function dismissTeaser(): void {
  sessionStorage.setItem(TEASER_KEY, '1')
  document.getElementById(TEASER_ID)?.remove()
}

/** Bulle d'accroche après 20s de visite, une fois par session (v6.0) */
function initTeaser(): void {
  if (sessionStorage.getItem(TEASER_KEY)) return
  setTimeout(() => {
    if (isOpen || sessionStorage.getItem(TEASER_KEY)) return
    const teaser = document.createElement('div')
    teaser.id = TEASER_ID
    teaser.setAttribute('role', 'button')
    teaser.setAttribute('tabindex', '0')
    teaser.innerHTML =
      '<span>Une question sur votre business ? 👋</span>' +
      '<button type="button" aria-label="Masquer">✕</button>'
    teaser.addEventListener('click', (e) => {
      const onDismiss = (e.target as HTMLElement).tagName === 'BUTTON'
      if (onDismiss) {
        dismissTeaser()
      } else {
        open() // open() retire aussi le teaser
      }
    })
    document.body.appendChild(teaser)
    sessionStorage.setItem(TEASER_KEY, '1')
    requestAnimationFrame(() => teaser.classList.add('ep-teaser--visible'))
  }, TEASER_DELAY_MS)
}

function initShortcuts(): void {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) close()
  })
}

function init(): void {
  config = { ...DEFAULTS, ...window.ePerformanceConfig }
  loadCss()
  createFrame()
  createBubble()
  window.addEventListener('message', onWidgetMessage)
  initKeyboardFix()
  initShortcuts()
  exposeApi()
  // État ouvert persistant (refresh → widget réouvert, même conversation)
  if (sessionStorage.getItem(OPEN_KEY) === '1') {
    open()
  } else {
    initTeaser()
  }
}

/** Exposé pour les tests (ré-initialisation DOM contrôlée) */
export { init as initSdk }

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}
