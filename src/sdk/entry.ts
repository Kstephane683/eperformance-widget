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
  /**
   * Couleur de la bulle. **Paramètre d'hôte, pas un jeton** : s'il est fourni,
   * il gagne toujours. Omis, la bulle prend `--gold` canonique selon le thème
   * détecté (DESIGN-SYSTEM-UNIFIE §5.5).
   */
  color?: string
  position: 'left' | 'right'
  /** 'auto' suit le thème du site (data-theme + localStorage eperf-theme) */
  theme?: 'auto' | 'light' | 'dark'
  /**
   * Racine du blog, où est publié `chatbot-index.json` (onglets Aide et
   * Actualités du widget). Transmise à l'iframe par le query param `indexUrl`.
   */
  blogIndexUrl?: string
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
  position: 'right',
  blogIndexUrl: 'https://blog.eperformance.pro',
}

/**
 * Jetons canoniques dupliqués dans le SDK — l'iframe et la page hôte peuvent
 * ne pas être ePerformance, et `var(--gold)` d'une page tierce n'a pas de sens.
 * Sur un hôte ePerformance, le jeton de la page gagne (`var(--gold, …)`) ;
 * ailleurs, ces valeurs servent de repli. Source : eperf.css:167-185,245-259.
 */
const CANON_GOLD = { light: '#856b37', dark: '#c9a96e' } // D6 / eperf.css:168,245
const CANON_GOLD_HOVER = { light: '#735d32', dark: '#e2c07a' } // eperf.css:169,246
const CANON_ON_GOLD = { light: '#ffffff', dark: '#0a0a0e' } // eperf.css:180,255
const CANON_CARD2 = { light: '#faf8f4', dark: '#14141a' } // eperf.css:160,239
const CANON_TEXT = { light: '#16151a', dark: '#edeae3' } // eperf.css:163,241

const MESSAGE_PREFIX = 'eperformance-widget:'
const BASE_Z_INDEX = 2147483000
/* Le bandeau `.consent` du site est un overlay légal (z-index: 120,
   eperf.css:1215) : le widget ne doit jamais le recouvrir. Même règle que le
   bouton WhatsApp du site (« body:has(.consent:not([hidden])) .wa-float
   { display: none } », eperf.css:1179). DÉCISION D9. */
const CONSENT_SELECTOR = '.consent'
const CONSENT_VISIBLE_CLASS = 'ep-consent-visible'
const CONSENT_SAFE_Z_INDEX = 119

/* Barre d'action collante du site — `.sticky-cta` (eperf.css:1189-1210) :
   fixed, collée en bas, z-index 90, affichée jusqu'à 720 px de large. Elle
   porte le bouton WhatsApp de la version mobile : le widget ne doit pas le
   recouvrir. DÉCISION 6.2-bis : quand le chat est FERMÉ, la bulle (et la
   bulle d'accroche) remontent de la hauteur RÉELLE mesurée de la barre ;
   quand le chat est OUVERT en mobile, il est plein écran (aucun conflit).
   Entre 669 et 720 px le panneau n'est pas plein écran : il remonte aussi. */
const STICKY_CTA_SELECTOR = '.sticky-cta'
/** Variable posée sur les éléments du SDK : décalage bas dynamique */
const CTA_OFFSET_VAR = '--ep-sdk-cta-offset'
const FRAME_ID = 'eperformance-widget-frame'
const HOLDER_ID = 'eperformance-widget-holder'
const BUBBLE_ID = 'eperformance-widget-bubble'
const TEASER_ID = 'eperformance-widget-teaser'
const OPEN_KEY = 'eperf_widget_open'
const TEASER_KEY = 'eperf_teaser_done'
const MOBILE_BREAKPOINT = 668
const TEASER_DELAY_MS = 20_000

/** Courbe et durées canoniques (eperf.css:214-218) — repli hors ePerformance */
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

// ============================================================
// CSS embarqué (pattern Chatwoot loadCSS — pas de fichier externe)
//
// Aucune valeur propre : chaque couleur est `var(--jeton-canonique, repli)`,
// le repli étant le jeton eperf.css recopié (la page hôte peut être tierce).
// Rayons : échelle 12 / 20 / 28 / 36 / 999 (eperf.css:146-149,202-206).
// Durées : --t / --t-fast + --ease-out (eperf.css:214-218).
// ============================================================

const SDK_CSS = `
#${HOLDER_ID} {
  position: fixed !important;
  /* Le décalage bas suit la hauteur réelle de .sticky-cta quand elle est
     affichée (0 px sinon) : le panneau ne recouvre jamais la barre CTA. */
  bottom: calc(88px + var(${CTA_OFFSET_VAR}, 0px));
  width: 400px;
  max-width: calc(100vw - 40px);
  height: min(650px, calc(100dvh - 110px));
  z-index: ${BASE_Z_INDEX} !important;
  opacity: 0;
  visibility: hidden;
  transform: translateY(24px) scale(0.98);
  transition: opacity var(--t, 300ms) var(--ease-out, ${EASE}),
              transform var(--t, 300ms) var(--ease-out, ${EASE}),
              visibility var(--t, 300ms);
  pointer-events: none;
}
/* Le bandeau de consentement du site (z-index: 120) passe devant le widget :
   tant qu'il est affiché, le holder redescend sous 120 (DÉCISION D9). */
#${HOLDER_ID}.${CONSENT_VISIBLE_CLASS} { z-index: ${CONSENT_SAFE_Z_INDEX} !important; }
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
  /* --arrondi-bloc vaut 12px dans eperf.css:148 (bloc, et non 20px comme le
     laissait croire le tableau §5.5 du document d'audit). */
  border-radius: var(--arrondi-bloc, 12px);
  box-shadow: var(--shadow-lg, 0 12px 32px rgba(22, 21, 26, 0.08), 0 32px 64px rgba(22, 21, 26, 0.09));
}
#${BUBBLE_ID} {
  position: fixed !important;
  /* Chat fermé : la bulle se pose AU-DESSUS de la barre CTA mobile
     (hauteur mesurée) — le bouton WhatsApp de la barre reste cliquable. */
  bottom: calc(20px + var(${CTA_OFFSET_VAR}, 0px));
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  z-index: ${BASE_Z_INDEX + 1} !important;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 2e ombre : le halo d'accent, comme le bouton WhatsApp du site */
  box-shadow: var(--shadow-lg, 0 12px 32px rgba(22, 21, 26, 0.08), 0 32px 64px rgba(22, 21, 26, 0.09)),
              0 0 0 6px var(--gold-bg, rgba(133, 107, 55, 0.07));
  background: var(--gold, var(--ep-sdk-gold));
  color: var(--on-gold, var(--ep-sdk-on-gold));
  transition: background-color var(--t, 300ms) var(--ease-out, ${EASE}),
              transform var(--t-fast, 150ms) var(--ease-out, ${EASE});
}
#${BUBBLE_ID}:hover { background: var(--gold2, var(--ep-sdk-gold-hover)); }
#${BUBBLE_ID}:active { transform: translateY(1px); }
#${BUBBLE_ID}.ep-bubble--right { right: 20px; }
#${BUBBLE_ID}.ep-bubble--left { left: 20px; }
/* Consentement affiché : la bulle (et la bulle d'accroche) s'effacent, comme
   le bouton WhatsApp du site — eperf.css:1179. */
#${BUBBLE_ID}.${CONSENT_VISIBLE_CLASS},
#${TEASER_ID}.${CONSENT_VISIBLE_CLASS} { display: none !important; }
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
  #${TEASER_ID} { right: 16px; bottom: calc(88px + var(${CTA_OFFSET_VAR}, 0px)); }
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
  /* Même décalage que la bulle : l'accroche ne recouvre pas la barre CTA */
  bottom: calc(88px + var(${CTA_OFFSET_VAR}, 0px));
  right: 20px;
  z-index: ${BASE_Z_INDEX + 2} !important;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 280px;
  padding: 12px 16px;
  /* 4px : queue de bulle, seule valeur hors échelle admise (DESIGN-SYSTEM-UNIFIE §5.5) */
  border-radius: var(--arrondi-bloc, 12px) var(--arrondi-bloc, 12px) 4px var(--arrondi-bloc, 12px);
  background: var(--card2, var(--ep-sdk-card2));
  color: var(--text, var(--ep-sdk-text));
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.45;
  box-shadow: var(--shadow-md, 0 4px 12px rgba(22, 21, 26, 0.06), 0 12px 28px rgba(22, 21, 26, 0.07)),
              0 0 0 1px var(--gold-border, rgba(133, 107, 55, 0.22));
  cursor: pointer;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity var(--t, 300ms) var(--ease-out, ${EASE}),
              transform var(--t, 300ms) var(--ease-out, ${EASE});
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
  background: var(--gold-bg, rgba(133, 107, 55, 0.07));
  color: var(--gold, var(--ep-sdk-gold));
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
    const message = JSON.parse(e.data.slice(MESSAGE_PREFIX.length)) as {
      event: string
      intent?: string | null
      leadType?: string
    }
    if (message.event === 'close' && isOpen) {
      close()
    }
    // Widget prêt après un refresh : resynchroniser son état avec celui du SDK
    // (l'open() initial peut arriver avant le montage du bridge dans l'iframe)
    if (message.event === 'ready') {
      postToWidget({ event: isOpen ? 'open' : 'close' })
      // Le widget vient de monter : il a besoin du gabarit de l'écran hôte
      // pour savoir si la barre d'onglets reste visible sur la conversation
      postToWidget({ event: 'viewport', viewport: detectViewport() })
    }
    // Le widget signale le focus/blur de son input : fiabilise le timing iOS
    // (le visualViewport resize peut arriver tard pendant l'animation clavier)
    if (message.event === 'input-focus' && isOpen) {
      keyboardUpdate?.()
      keyboardForceUpdate?.()
    }
    // Contrat N3 — voir la section « Événements de mesure » plus bas
    if (message.event === 'message') {
      relayChatbotMessage(message.intent)
    }
    if (message.event === 'lead') {
      relayChatbotLead(message.leadType)
    }
  } catch {
    // Ignoré
  }
}

// ============================================================
// CONTRAT N3 — ÉVÉNEMENTS DE MESURE POUR LA PAGE HÔTE
//
// Le noyau (agent-ia-web, `docs/chatbot-integration-noyau.md`) et le site
// (`assets/js/tracking.js`) écoutent déjà deux événements personnalisés sur
// le document de la page :
//
//   document.addEventListener('eperf:chatbot:message', …)  → GA4 chatbot_message
//   document.addEventListener('eperf:chatbot:lead', …)     → GA4 chatbot_lead
//
// Le widget est dans une iframe : il ne peut pas les poser lui-même. Il les
// envoie par postMessage et le SDK les rediffuse ici, sur le document de la
// page hôte — c'est le seul endroit du SDK qui s'exécute dans la page.
//
// VIE PRIVÉE : les `detail` ne contiennent qu'une catégorie (`intent`) ou une
// valeur d'énumération (`type`). Jamais de nom, d'e-mail, de téléphone ni de
// contenu de message — les écouteurs du site ne reçoivent rien d'exploitable
// comme donnée personnelle. Les valeurs non conformes sont REJETÉES ici :
// un SDK qui relaierait n'importe quoi laisserait une page hôte injecter du
// texte libre dans un événement de mesure.
// ============================================================

/** Types de lead admis (énumération fermée, contrat N3) */
const TYPES_LEAD = ['whatsapp_clic', 'formulaire', 'email_clic']
/** Catégories d'intent admises : minuscules, chiffres, tirets, soulignés */
const MOTIF_INTENT = /^[a-z0-9_-]{1,40}$/

/** Rediffuse `eperf:chatbot:message` sur le document de la page hôte */
function relayChatbotMessage(intent?: string | null) {
  const valeur = typeof intent === 'string' ? intent.trim().toLowerCase() : ''
  const detail = { intent: MOTIF_INTENT.test(valeur) ? valeur : 'non_detecte' }
  document.dispatchEvent(new CustomEvent('eperf:chatbot:message', { detail }))
}

/** Rediffuse `eperf:chatbot:lead` sur le document de la page hôte */
function relayChatbotLead(leadType?: string) {
  if (!leadType || !TYPES_LEAD.includes(leadType)) return
  document.dispatchEvent(
    new CustomEvent('eperf:chatbot:lead', { detail: { type: leadType } }),
  )
}

// ============================================================
// DOM : iframe + bubble
// ============================================================

const THEME_STORAGE_KEY = 'eperf-theme'

/**
 * Thème du site hôte. L'iframe est cross-origin : elle ne peut pas lire le
 * localStorage de la page — c'est le SDK (même origine que le site) qui le
 * détecte et le lui transmet (query param au chargement + postMessage ensuite).
 */
function detectTheme(): 'light' | 'dark' {
  if (config.theme === 'light' || config.theme === 'dark') return config.theme
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'dark' || attr === 'light') return attr
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    /* stockage bloqué */
  }
  return 'light' // défaut du site
}

/**
 * Observe le toggle du site et propage le changement à l'iframe.
 * La bulle, elle, n'est pas dans l'iframe : son accent est recalculé ici.
 */
/** Prévient l'iframe quand la fenêtre hôte change de gabarit (rotation, etc.) */
function initViewportBridge(): void {
  if (typeof window.matchMedia !== 'function') return
  const requete = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
  requete.addEventListener('change', () => {
    postToWidget({ event: 'viewport', viewport: detectViewport() })
    planifierMesureCta()
  })
}

function initThemeBridge(): void {
  const push = () => {
    applyBubbleColor()
    postToWidget({ event: 'theme', theme: detectTheme() })
  }
  new MutationObserver(push).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_STORAGE_KEY) push()
  })
}

/**
 * Accent de la bulle. `config.color` (paramètre d'hôte) gagne s'il est fourni ;
 * sinon on suit le thème détecté — DÉCISION §5.5 : `#856b37` en clair,
 * `#c9a96e` en sombre. Les valeurs sont posées en variables locales que le CSS
 * utilise en repli de `var(--gold)`, donc sur eperformance.pro le jeton du site
 * (thème compris) reste maître (DESIGN-SYSTEM-UNIFIE §5.5).
 */
function applyBubbleColor(): void {
  const bubble = document.getElementById(BUBBLE_ID)
  if (!bubble) return
  if (config.color) {
    // Couleur de marque explicite : elle prime sur tout jeton (paramètre d'hôte)
    bubble.style.background = config.color
    return
  }
  bubble.style.removeProperty('background')
  const theme = detectTheme()
  bubble.style.setProperty('--ep-sdk-gold', CANON_GOLD[theme])
  bubble.style.setProperty('--ep-sdk-gold-hover', CANON_GOLD_HOVER[theme])
  bubble.style.setProperty('--ep-sdk-on-gold', CANON_ON_GOLD[theme])
}

/** Pose les replis de jetons du thème courant sur un élément du SDK (teaser) */
function applyThemeTokens(el: HTMLElement): void {
  const theme = detectTheme()
  el.style.setProperty('--ep-sdk-gold', CANON_GOLD[theme])
  el.style.setProperty('--ep-sdk-gold-hover', CANON_GOLD_HOVER[theme])
  el.style.setProperty('--ep-sdk-card2', CANON_CARD2[theme])
  el.style.setProperty('--ep-sdk-text', CANON_TEXT[theme])
}

/** Couleur effective transmise à l'iframe (query param `color`) */
function effectiveColor(): string {
  return config.color ?? CANON_GOLD[detectTheme()]
}

/**
 * Gabarit de l'écran HÔTE. L'iframe ne mesure que 400 px de large sur un
 * desktop : mesurée à l'intérieur de l'iframe, la requête média répondrait
 * « mobile ». C'est donc la fenêtre du site qui tranche — elle décide déjà du
 * plein écran (MOBILE_BREAKPOINT) — et le SDK transmet le résultat : query
 * param au chargement, postMessage à chaque franchissement.
 */
function detectViewport(): 'mobile' | 'desktop' {
  if (typeof window.matchMedia !== 'function') return 'desktop'
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches ? 'mobile' : 'desktop'
}

function buildFrameSrc(): string {
  const url = new URL(config.widgetUrl, window.location.href)
  url.searchParams.set('apiUrl', config.apiUrl)
  url.searchParams.set('siteId', config.siteId)
  url.searchParams.set('color', effectiveColor())
  url.searchParams.set('theme', detectTheme())
  url.searchParams.set('viewport', detectViewport())
  // Racine du blog : l'index des onglets Aide/Actualités y est publié
  if (config.blogIndexUrl) {
    url.searchParams.set('indexUrl', config.blogIndexUrl)
  }
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
  bubble.innerHTML = CHAT_ICON
  bubble.addEventListener('click', toggle)

  document.body.appendChild(bubble)
  applyBubbleColor()
}

// ============================================================
// Garde du bandeau de consentement (DÉCISION D9)
//
// Le bandeau `.consent` du site (z-index: 120, eperf.css:1215) est un overlay
// légal : il ne doit JAMAIS être recouvert par le widget. Le site applique
// déjà la règle au bouton WhatsApp :
//   body:has(.consent:not([hidden])) .wa-float { display: none }  (eperf.css:1179)
// On la reproduit côté SDK : tant que le bandeau est visible, la bulle (et la
// bulle d'accroche) sont masquées et le holder redescend sous 120 ; dès qu'il
// disparaît, tout est réactivé.
// ============================================================

/**
 * Le bandeau de consentement est-il affiché ?
 * `hidden` (ce que pose consent.js) + visibilité calculée, pour couvrir un
 * bandeau masqué par CSS plutôt que par l'attribut.
 */
function isConsentVisible(): boolean {
  if (typeof document === 'undefined') return false // environnement détruit (tests)
  const el = document.querySelector<HTMLElement>(CONSENT_SELECTOR)
  if (!el || el.hidden) return false
  const style = window.getComputedStyle(el)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

/** Applique (ou retire) l'état « consentement affiché » sur tout le widget */
function applyConsentState(): void {
  if (typeof document === 'undefined') return
  const visible = isConsentVisible()
  for (const id of [BUBBLE_ID, TEASER_ID, HOLDER_ID]) {
    document.getElementById(id)?.classList.toggle(CONSENT_VISIBLE_CLASS, visible)
  }
}

let consentObserver: MutationObserver | null = null
let consentIntersectionObserver: IntersectionObserver | null = null

/**
 * Surveillance : MutationObserver sur `hidden` (et sur l'insertion/retrait du
 * bandeau), IntersectionObserver en secours pour une disparition visuelle qui
 * ne produirait aucune mutation. Aucun réseau, aucun impact sur le widget.
 */
function initConsentGuard(): void {
  // Une seule surveillance active, même si init() est rappelé (tests)
  consentObserver?.disconnect()
  consentIntersectionObserver?.disconnect()

  applyConsentState()

  const body = document.body
  if (!body) return

  consentObserver = new MutationObserver(() => applyConsentState())
  consentObserver.observe(body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'style', 'class'],
  })

  /* Secours : le bandeau peut devenir invisible (display:none par une règle
     CSS, déplacement) sans mutation d'attribut observable. */
  if (typeof IntersectionObserver !== 'undefined') {
    const el = document.querySelector<HTMLElement>(CONSENT_SELECTOR)
    if (el) {
      consentIntersectionObserver = new IntersectionObserver(() => applyConsentState(), {
        threshold: [0, 1],
      })
      consentIntersectionObserver.observe(el)
    }
  }
}

// ============================================================
// Garde de la barre CTA collante (DÉCISION tâche 6.2-bis)
//
// BUG CORRIGÉ : sur mobile, la bulle du widget (bottom: 20px) recouvrait le
// bouton WhatsApp de `.sticky-cta` (barre fixe en bas, z-index 90,
// eperf.css:1189-1210). La bulle est au-dessus en z-index : le bouton
// devenait inutilisable.
//
// DÉCISION : la barre CTA reste VISIBLE et CLIQUABLE. La bulle (et la bulle
// d'accroche) remontent de la hauteur RÉELLE de la barre + 8 px de respiration.
// Le panneau de chat suit le même décalage tant qu'il n'est pas plein écran
// (669-720 px) ; en dessous de 668 px il est plein écran, donc sans conflit —
// et la bulle y est masquée pendant que le chat est ouvert.
//
// Mise en œuvre identique à la garde `.consent` (D9) : observation du DOM
// (MutationObserver), secours par observation de taille et de position, plus
// les événements de redimensionnement. Aucun réseau, aucun coût mesurable.
// ============================================================

/** Marge entre la barre CTA et le widget : 8 px (respiration, pas un jeton) */
const CTA_GAP_PX = 8

/**
 * Hauteur à réserver sous le widget.
 * 0 si la barre est absente, masquée, ou pas collée au bas de la fenêtre.
 */
function mesurerBarreCta(): number {
  if (typeof document === 'undefined') return 0
  const barre = document.querySelector<HTMLElement>(STICKY_CTA_SELECTOR)
  if (!barre || barre.hidden) return 0
  const style = window.getComputedStyle(barre)
  if (style.display === 'none' || style.visibility === 'hidden') return 0
  const rect = barre.getBoundingClientRect()
  if (rect.height <= 0) return 0
  // Seules les barres collées au bas de la fenêtre gênent le widget
  const colleeEnBas = rect.bottom >= window.innerHeight - 2
  if (!colleeEnBas) return 0
  return Math.ceil(rect.height) + CTA_GAP_PX
}

/** Applique (ou retire) le décalage sur les éléments du SDK */
function applyCtaOffset(): void {
  if (typeof document === 'undefined') return
  const offset = mesurerBarreCta()
  const valeur = `${offset}px`
  for (const id of [BUBBLE_ID, TEASER_ID, HOLDER_ID]) {
    const el = document.getElementById(id)
    if (!el) continue
    if (offset > 0) {
      el.style.setProperty(CTA_OFFSET_VAR, valeur)
    } else {
      el.style.removeProperty(CTA_OFFSET_VAR)
    }
  }
}

let ctaObserver: MutationObserver | null = null
let ctaResizeObserver: ResizeObserver | null = null
let ctaRafPending = false

/** Regroupe les recalculs d'une même frame (les observers sont bavards) */
function planifierMesureCta(): void {
  if (ctaRafPending) return
  ctaRafPending = true
  const rappel = () => {
    ctaRafPending = false
    applyCtaOffset()
  }
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(rappel)
  } else {
    setTimeout(rappel, 0)
  }
}

function initStickyCtaGuard(): void {
  ctaObserver?.disconnect()
  ctaResizeObserver?.disconnect()

  applyCtaOffset()

  const body = document.body
  if (!body) return

  // Apparition/disparition de la barre, changement de hauteur (contenu, police)
  ctaObserver = new MutationObserver(planifierMesureCta)
  ctaObserver.observe(body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'style', 'class'],
  })

  if (typeof ResizeObserver !== 'undefined') {
    const barre = document.querySelector<HTMLElement>(STICKY_CTA_SELECTOR)
    if (barre) {
      ctaResizeObserver = new ResizeObserver(planifierMesureCta)
      ctaResizeObserver.observe(barre)
    }
  }

  // La barre n'existe qu'en dessous de 720 px : le franchissement du seuil
  // se voit au redimensionnement (et au passage en paysage).
  window.addEventListener('resize', planifierMesureCta)
  window.addEventListener('orientationchange', planifierMesureCta)
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
  postToWidget({ event: 'open', theme: detectTheme(), viewport: detectViewport() })
  keyboardUpdate?.()
  applyConsentState()
  applyCtaOffset()
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
  applyConsentState()
  // La bulle réapparaît : elle se repose au-dessus de la barre CTA si présente
  applyCtaOffset()
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
      '<span>Une question sur votre business ?</span>' +
      '<button type="button" aria-label="Masquer">✕</button>'
    teaser.addEventListener('click', (e) => {
      const onDismiss = (e.target as HTMLElement).tagName === 'BUTTON'
      if (onDismiss) {
        dismissTeaser()
      } else {
        open() // open() retire aussi le teaser
      }
    })
    applyThemeTokens(teaser)
    document.body.appendChild(teaser)
    applyCtaOffset() // la barre CTA mobile peut être sous l'accroche
    sessionStorage.setItem(TEASER_KEY, '1')
    requestAnimationFrame(() => teaser.classList.add('ep-teaser--visible'))
    applyConsentState()
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
  initThemeBridge()
  initViewportBridge()
  initConsentGuard()
  initStickyCtaGuard()
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
