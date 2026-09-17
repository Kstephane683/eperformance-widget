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
