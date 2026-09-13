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
})
