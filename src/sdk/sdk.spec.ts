/**
 * Tests SDK + bridge — protocole postMessage `eperformance-widget:`
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { initSdkBridge, MESSAGE_PREFIX, notifyReady, postToSdk } from '@/helpers/sdkBridge'
import { initSdk } from '@/sdk/entry'

function postFromWidget(event: Record<string, unknown>) {
  window.dispatchEvent(
    new MessageEvent('message', { data: `${MESSAGE_PREFIX}${JSON.stringify(event)}` }),
  )
}

beforeEach(() => {
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  initSdk()
  vi.clearAllMocks()
})

describe('SDK (entry.ts)', () => {
  it('injecte la bubble, le holder et l iframe au chargement', () => {
    expect(document.getElementById('eperformance-widget-bubble')).toBeTruthy()
    expect(document.getElementById('eperformance-widget-holder')).toBeTruthy()
    const iframe = document.getElementById('eperformance-widget-frame') as HTMLIFrameElement
    expect(iframe).toBeTruthy()
    expect(iframe.src).toContain('apiUrl=')
    expect(iframe.src).toContain('siteId=eperformance_vitrine')
  })

  it('expose l API window.ePerformance', () => {
    expect(window.ePerformance).toBeTruthy()
    expect(typeof window.ePerformance?.open).toBe('function')
    expect(typeof window.ePerformance?.close).toBe('function')
    expect(typeof window.ePerformance?.toggle).toBe('function')
    expect(typeof window.ePerformance?.identify).toBe('function')
    expect(typeof window.ePerformance?.on).toBe('function')
  })

  it('open/close toggle la visibilité du holder et l icône', () => {
    window.ePerformance!.open()
    expect(document.getElementById('eperformance-widget-holder')?.classList).toContain(
      'ep-holder--visible',
    )
    // icône croix = ouverte
    expect(document.getElementById('eperformance-widget-bubble')?.innerHTML).toContain(
      'stroke-width',
    )

    window.ePerformance!.close()
    expect(document.getElementById('eperformance-widget-holder')?.classList).not.toContain(
      'ep-holder--visible',
    )
  })

  it('open/close déclenche les listeners enregistrés via on()', () => {
    const onOpen = vi.fn()
    const onClose = vi.fn()
    window.ePerformance!.on('open', onOpen)
    window.ePerformance!.on('close', onClose)

    window.ePerformance!.open()
    window.ePerformance!.close()

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('double open (ou double close) est ignoré', () => {
    window.ePerformance!.open()
    window.ePerformance!.open()
    window.ePerformance!.close()
    window.ePerformance!.close()
    // pas d'exception, état stable — vérifié via listeners
    const onOpen = vi.fn()
    window.ePerformance!.on('open', onOpen)
    window.ePerformance!.open()
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('identify poste un message vers l iframe (contentWindow mocké)', () => {
    const frame = document.getElementById('eperformance-widget-frame') as HTMLIFrameElement
    const postMessage = vi.fn()
    Object.defineProperty(frame, 'contentWindow', {
      value: { postMessage },
    })

    window.ePerformance!.identify(42, { name: 'Jean' })

    expect(postMessage).toHaveBeenCalledTimes(1)
    const raw = postMessage.mock.calls[0][0] as string
    expect(raw.startsWith(MESSAGE_PREFIX)).toBe(true)
    expect(raw).toContain('"event":"identify"')
    expect(raw).toContain('"userId":42')
  })
})

describe('sdkBridge (côté widget)', () => {
  it('initSdkBridge route open/close/identify vers les handlers', () => {
    const onOpen = vi.fn()
    const onClose = vi.fn()
    const onIdentify = vi.fn()
    initSdkBridge({ onOpen, onClose, onIdentify })

    postFromWidget({ event: 'open' })
    postFromWidget({ event: 'close' })
    postFromWidget({ event: 'identify', userId: 7, userData: { phone: '+225' } })
    // message étranger ignoré sans exception
    window.dispatchEvent(new MessageEvent('message', { data: 'chatwoot-widget:{}' }))

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onIdentify).toHaveBeenCalledWith(7, { phone: '+225' })
  })

  it('cleanup retire le listener', () => {
    const onOpen = vi.fn()
    const cleanup = initSdkBridge({ onOpen, onClose: vi.fn(), onIdentify: vi.fn() })

    cleanup()
    postFromWidget({ event: 'open' })

    expect(onOpen).not.toHaveBeenCalled()
  })

  it('postToSdk écrit vers window.parent (no-op si pas d iframe)', () => {
    // window.parent === window en jsdom → pas d'exception
    expect(() => postToSdk({ event: 'ready' })).not.toThrow()
    expect(() => notifyReady()).not.toThrow()
  })

  it("détecte le thème du site et le transmet à l'iframe (data-theme)", () => {
    // Thème sombre posé par le site hôte
    document.documentElement.setAttribute('data-theme', 'dark')
    const frame = document.getElementById('eperformance-widget-frame') as HTMLIFrameElement
    const postMessage = vi.fn()
    Object.defineProperty(frame, 'contentWindow', { value: { postMessage } })

    window.ePerformance!.open()

    const raw = postMessage.mock.calls.map((c) => String(c[0])).join(' ')
    expect(raw).toContain('"theme":"dark"')
    document.documentElement.removeAttribute('data-theme')
  })

  it("le widget suit le basculement clair/sombre du site (événement 'theme')", () => {
    const onOpen = vi.fn()
    initSdkBridge({ onOpen, onClose: vi.fn(), onIdentify: vi.fn() })

    postFromWidget({ event: 'theme', theme: 'dark' })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    postFromWidget({ event: 'theme', theme: 'light' })
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    document.documentElement.removeAttribute('data-theme')
  })
})

describe('SDK — jetons canoniques (tâche 6.2)', () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

  function bubbleEl() {
    return document.getElementById('eperformance-widget-bubble') as HTMLElement
  }

  it("la bulle prend l'accent canonique clair par défaut (#856b37, D6)", () => {
    // Aucun data-theme : le défaut du site est clair (SDK:266)
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    expect(bubbleEl().style.getPropertyValue('--ep-sdk-gold')).toBe('#856b37')
    expect(bubbleEl().style.getPropertyValue('--ep-sdk-gold-hover')).toBe('#735d32')
    expect(bubbleEl().style.getPropertyValue('--ep-sdk-on-gold')).toBe('#ffffff')
  })

  it('la bulle suit la bascule sombre du site (#c9a96e / #e2c07a)', async () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    await tick() // le MutationObserver du pont de thème pousse le changement

    expect(bubbleEl().style.getPropertyValue('--ep-sdk-gold')).toBe('#c9a96e')
    expect(bubbleEl().style.getPropertyValue('--ep-sdk-gold-hover')).toBe('#e2c07a')
    expect(bubbleEl().style.getPropertyValue('--ep-sdk-on-gold')).toBe('#0a0a0e')
    document.documentElement.removeAttribute('data-theme')
  })

  it("une couleur explicite de l'hôte gagne sur le jeton du thème", () => {
    window.ePerformanceConfig = { color: '#ff0000' }
    document.body.innerHTML = ''
    document.head.innerHTML = ''
    try {
      initSdk()
      expect(bubbleEl().getAttribute('style') ?? '').toMatch(/#ff0000|255,\s*0,\s*0/i)
      // le paramètre est aussi transmis à l'iframe
      const frame = document.getElementById('eperformance-widget-frame') as HTMLIFrameElement
      expect(decodeURIComponent(frame.src)).toContain('color=#ff0000')
    } finally {
      window.ePerformanceConfig = undefined
    }
  })

  it("l'iframe reçoit le thème détecté (anti-flash de index.html)", () => {
    const frame = document.getElementById('eperformance-widget-frame') as HTMLIFrameElement
    expect(frame.src).toContain('theme=light')
  })
})

describe('SDK — bandeau de consentement (D9)', () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

  function ids() {
    return {
      bubble: document.getElementById('eperformance-widget-bubble') as HTMLElement,
      holder: document.getElementById('eperformance-widget-holder') as HTMLElement,
    }
  }

  function addConsentBanner(): HTMLElement {
    const banner = document.createElement('div')
    banner.className = 'consent'
    banner.id = 'consent-banner'
    document.body.appendChild(banner)
    return banner
  }

  it('masque la bulle et abaisse le holder sous z-index 120 tant que le bandeau est affiché', async () => {
    const banner = addConsentBanner()
    initSdk() // le bandeau est déjà dans le DOM → l'état doit être appliqué tout de suite

    expect(ids().bubble.classList.contains('ep-consent-visible')).toBe(true)
    expect(ids().holder.classList.contains('ep-consent-visible')).toBe(true)

    // La règle CSS abaisse le holder sous .consent (z-index: 120, eperf.css:1215)
    const css = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n')
    expect(css).toContain('z-index: 119 !important')
    expect(css).toContain('display: none !important')

    // L'utilisateur a exprimé son choix : consent.js pose `hidden`
    banner.hidden = true
    await tick()

    expect(ids().bubble.classList.contains('ep-consent-visible')).toBe(false)
    expect(ids().holder.classList.contains('ep-consent-visible')).toBe(false)
  })

  it('réagit à un bandeau injecté après le chargement du SDK', async () => {
    expect(ids().bubble.classList.contains('ep-consent-visible')).toBe(false)

    const banner = addConsentBanner()
    await tick()

    expect(ids().bubble.classList.contains('ep-consent-visible')).toBe(true)

    banner.remove()
    await tick()
    expect(ids().bubble.classList.contains('ep-consent-visible')).toBe(false)
  })

  it('ne masque rien quand le bandeau est présent mais déjà [hidden]', async () => {
    const banner = addConsentBanner()
    banner.hidden = true
    await tick()

    expect(ids().bubble.classList.contains('ep-consent-visible')).toBe(false)
    expect(ids().holder.classList.contains('ep-consent-visible')).toBe(false)
  })
})

describe('SDK — barre CTA collante du site (tâche 6.2-bis)', () => {
  /**
   * Barre `.sticky-cta` simulée : jsdom ne calcule aucune mise en page, on
   * pose donc un rectangle réel (hauteur + collage au bas de la fenêtre),
   * comme le navigateur le ferait sur mobile (eperf.css:1189-1210).
   */
  function ajouterBarreCta(hauteur = 68) {
    const barre = document.createElement('div')
    barre.className = 'sticky-cta'
    document.body.appendChild(barre)
    barre.getBoundingClientRect = () =>
      ({
        height: hauteur,
        width: window.innerWidth,
        top: window.innerHeight - hauteur,
        bottom: window.innerHeight,
      }) as DOMRect
    return barre
  }

  function el(id: string) {
    return document.getElementById(id) as HTMLElement
  }

  function marge(id: string) {
    return el(id).style.getPropertyValue('--ep-sdk-cta-offset')
  }

  it('remonte la bulle de la hauteur réelle de la barre + 8 px', async () => {
    ajouterBarreCta(68)
    initSdk() // la barre est déjà dans le DOM → mesure immédiate

    // 68 px de barre + 8 px de respiration
    expect(marge('eperformance-widget-bubble')).toBe('76px')
    // Le panneau et l'accroche suivent la même règle
    expect(marge('eperformance-widget-holder')).toBe('76px')

    // Le CSS injecté consomme bien la variable
    const css = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n')
    expect(css).toContain('bottom: calc(20px + var(--ep-sdk-cta-offset, 0px))')
    expect(css).toContain('bottom: calc(88px + var(--ep-sdk-cta-offset, 0px))')
  })

  it('ne décale rien en l’absence de barre CTA (desktop)', () => {
    initSdk()
    expect(marge('eperformance-widget-bubble')).toBe('')
    expect(marge('eperformance-widget-holder')).toBe('')
  })

  it('ignore une barre masquée ou absente du bas de la fenêtre', async () => {
    const barre = ajouterBarreCta(68)
    barre.style.display = 'none'
    initSdk()
    expect(marge('eperformance-widget-bubble')).toBe('')

    // Barre visible mais pas collée au bas (contenu en milieu de page)
    barre.style.display = 'flex'
    barre.getBoundingClientRect = () =>
      ({ height: 68, width: 360, top: 100, bottom: 168 }) as DOMRect
    initSdk()
    expect(marge('eperformance-widget-bubble')).toBe('')
  })

  it('suit l’apparition et la disparition de la barre (observation du DOM)', async () => {
    initSdk()
    expect(marge('eperformance-widget-bubble')).toBe('')

    // Le site affiche sa barre après coup (ou change de gabarit)
    const barre = ajouterBarreCta(72)
    await vi.waitFor(() => expect(marge('eperformance-widget-bubble')).toBe('80px'))

    // Elle disparaît : la bulle redescend à sa position normale
    barre.remove()
    await vi.waitFor(() => expect(marge('eperformance-widget-bubble')).toBe(''))
  })

  it('remesure quand la hauteur de la barre change', async () => {
    const barre = ajouterBarreCta(60)
    initSdk()
    expect(marge('eperformance-widget-bubble')).toBe('68px')

    // La barre grandit (libellé sur deux lignes, safe-area iOS…)
    barre.getBoundingClientRect = () =>
      ({ height: 92, width: 360, top: window.innerHeight - 92, bottom: window.innerHeight }) as DOMRect
    barre.setAttribute('style', '') // mutation observée par le SDK

    await vi.waitFor(() => expect(marge('eperformance-widget-bubble')).toBe('100px'))
  })
})

describe('SDK — gabarit de l’écran hôte (tâche 6.2-bis)', () => {
  it("transmet le gabarit mesuré sur la fenêtre HÔTE, pas sur l'iframe", () => {
    // Une iframe de widget fait 400 px sur un desktop : si elle mesurait
    // elle-même, elle se croirait mobile. C'est le SDK qui tranche.
    const matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn() })
    vi.stubGlobal('matchMedia', matchMedia)

    try {
      document.body.innerHTML = ''
      document.head.innerHTML = ''
      initSdk()

      expect(matchMedia).toHaveBeenCalledWith('(max-width: 668px)')
      const frame = document.getElementById('eperformance-widget-frame') as HTMLIFrameElement
      expect(frame.src).toContain('viewport=mobile')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('répond au widget prêt en lui envoyant le gabarit courant', () => {
    const frame = document.getElementById('eperformance-widget-frame') as HTMLIFrameElement
    const postMessage = vi.fn()
    Object.defineProperty(frame, 'contentWindow', { value: { postMessage } })

    // jsdom n'expose pas matchMedia → gabarit desktop
    postFromWidget({ event: 'ready' })

    const envoyes = postMessage.mock.calls.map((c) => String(c[0])).join(' ')
    expect(envoyes).toContain('"event":"viewport"')
    expect(envoyes).toContain('"viewport":"desktop"')
  })
})

// ============================================================
// CONTRAT N3 — événements de mesure rediffusés sur la page hôte
//
// Le noyau (agent-ia-web) et le site écoutent `eperf:chatbot:message` et
// `eperf:chatbot:lead` sur le document. Le SDK les rediffuse à partir des
// postMessage du widget. Forme imposée : `detail.intent` (catégorie) et
// `detail.type` (énumération), jamais de donnée personnelle.
// ============================================================

describe('Contrat N3 — événements de mesure', () => {
  function capter(nom: string): Array<Record<string, unknown>> {
    const recus: Array<Record<string, unknown>> = []
    document.addEventListener(nom, (e) => recus.push((e as CustomEvent).detail))
    return recus
  }

  it('rediffuse `eperf:chatbot:message` avec la catégorie d’intent', () => {
    const recus = capter('eperf:chatbot:message')

    postFromWidget({ event: 'message', intent: 'seo' })

    expect(recus).toHaveLength(1)
    expect(recus[0]).toEqual({ intent: 'seo' })
  })

  it('retombe sur `non_detecte` quand l’intent est absent', () => {
    const recus = capter('eperf:chatbot:message')

    postFromWidget({ event: 'message', intent: null })

    expect(recus[0]).toEqual({ intent: 'non_detecte' })
  })

  it('rejette un intent qui n’est pas une catégorie', () => {
    const recus = capter('eperf:chatbot:message')

    // Une page hôte ne doit pas pouvoir faire transiter du texte libre
    postFromWidget({ event: 'message', intent: 'Je veux un devis, je suis Fatou' })
    postFromWidget({ event: 'message', intent: 'a'.repeat(80) })

    expect(recus.map((d) => d.intent)).toEqual(['non_detecte', 'non_detecte'])
  })

  it('rediffuse `eperf:chatbot:lead` avec un type d’énumération', () => {
    const recus = capter('eperf:chatbot:lead')

    postFromWidget({ event: 'lead', leadType: 'whatsapp_clic' })
    postFromWidget({ event: 'lead', leadType: 'formulaire' })

    expect(recus).toEqual([{ type: 'whatsapp_clic' }, { type: 'formulaire' }])
  })

  it('ignore un type de lead hors énumération', () => {
    const recus = capter('eperf:chatbot:lead')

    postFromWidget({ event: 'lead', leadType: 'Fatou +225 01 51 17 06 66' })
    postFromWidget({ event: 'lead', leadType: 'autre_chose' })

    expect(recus).toEqual([])
  })

  it('ne transporte AUCUNE donnée personnelle dans le détail', () => {
    const messages = capter('eperf:chatbot:message')
    const leads = capter('eperf:chatbot:lead')

    // Un message contenant des coordonnées : seul l'intent doit sortir
    postFromWidget({
      event: 'message',
      intent: 'clients',
      label: 'Trouver plus de clients',
      text: 'Appelle-moi au 01 51 17 06 66',
      telephone: '+2250151170666',
      email: 'contact@exemple.com',
      nom: 'Fatou',
    })
    postFromWidget({ event: 'lead', leadType: 'formulaire' })

    const details = JSON.stringify([...messages, ...leads])
    for (const interdit of [
      '01 51 17 06 66',
      '+2250151170666',
      'contact@exemple.com',
      'Fatou',
      'Appelle-moi',
      'Trouver plus de clients',
    ]) {
      expect(details).not.toContain(interdit)
    }
    // Les clés elles-mêmes sont fermées
    expect(Object.keys(messages[0])).toEqual(['intent'])
    expect(Object.keys(leads[0])).toEqual(['type'])
  })

  it('n’altère pas l’API existante on(open|close)', () => {
    const onOpen = vi.fn()
    // État neutre : open() est idempotent, un vrai changement d'état est
    // nécessaire pour que les listeners se déclenchent.
    window.ePerformance!.close()
    window.ePerformance!.on('open', onOpen)

    postFromWidget({ event: 'message', intent: 'seo' })
    window.ePerformance!.open()

    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
