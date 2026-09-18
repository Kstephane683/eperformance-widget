/**
 * Tests des helpers ajoutés en tâche 6.2-bis : dates relatives (liste des
 * conversations, signature des messages), dictée vocale, vignettes de
 * collection.
 */
import { describe, expect, it, vi } from 'vitest'

import { vignetteCollection } from '@/helpers/iconesCollections'
import { dateCourte, tempsRelatif } from '@/helpers/relativeTime'
import { creerDictee, DICTEE_INDISPONIBLE, dicteeDisponible } from '@/helpers/speech'

const MAINTENANT = Date.parse('2026-09-17T12:00:00Z')

function ilYA(secondes: number): string {
  return new Date(MAINTENANT - secondes * 1000).toISOString()
}

describe('tempsRelatif', () => {
  it('affiche « à l’instant » pour les toutes dernières secondes', () => {
    expect(tempsRelatif(ilYA(5), MAINTENANT)).toBe("à l'instant")
  })

  it('affiche les minutes et les heures en français', () => {
    expect(tempsRelatif(ilYA(120), MAINTENANT)).toBe('il y a 2 minutes')
    expect(tempsRelatif(ilYA(3 * 3600), MAINTENANT)).toBe('il y a 3 heures')
  })

  it('affiche « hier » puis une date courte au-delà d’une semaine', () => {
    expect(tempsRelatif(ilYA(26 * 3600), MAINTENANT)).toBe('hier')
    expect(tempsRelatif(ilYA(3 * 86400), MAINTENANT)).toMatch(/jours/)
    expect(tempsRelatif(ilYA(30 * 86400), MAINTENANT)).toMatch(/août|sept/)
  })

  it('retourne une chaîne vide pour une date absente ou invalide', () => {
    expect(tempsRelatif(null)).toBe('')
    expect(tempsRelatif('pas une date')).toBe('')
  })

  it('traite un horodatage de quelques secondes dans le futur comme « à l’instant »', () => {
    // Cas réel : le message est créé quelques ms après le montage du fil
    expect(tempsRelatif(ilYA(-0.05), MAINTENANT)).toBe("à l'instant")
    expect(tempsRelatif(ilYA(-30), MAINTENANT)).toBe("à l'instant")
  })

  it('affiche une date en clair pour une date réellement à venir (article programmé)', () => {
    expect(tempsRelatif(ilYA(-3 * 86400), MAINTENANT)).toMatch(/\d/)
  })
})

describe('dateCourte', () => {
  it('formate une date éditoriale en français', () => {
    expect(dateCourte('2026-09-16T09:00:00+00:00')).toBe('16 sept. 2026')
  })

  it('accepte une valeur manquante', () => {
    expect(dateCourte(null)).toBe('')
    expect(dateCourte('')).toBe('')
  })
})

describe('dictée vocale (Web Speech API)', () => {
  it('signale l’indisponibilité quand l’API est absente', () => {
    delete (window as { SpeechRecognition?: unknown }).SpeechRecognition
    delete (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition

    expect(dicteeDisponible()).toBe(false)
    expect(creerDictee({ onTexte: vi.fn(), onEtat: vi.fn() })).toBeNull()
    expect(DICTEE_INDISPONIBLE).toContain('pas disponible')
  })

  it('pilote une reconnaissance simulée : transcription puis état d’écoute', () => {
    const onTexte = vi.fn()
    const onEtat = vi.fn()
    // La fausse reconnaissance s'enregistre au démarrage : le test peut
    // ensuite déclencher la transcription, comme le navigateur le ferait.
    const instances: Array<{
      onresult: ((e: { results: ArrayLike<unknown> }) => void) | null
    }> = []

    class FausseReco {
      lang = ''
      continuous = false
      interimResults = false
      onresult: ((e: { results: ArrayLike<unknown> }) => void) | null = null
      onerror: ((e: { error?: string }) => void) | null = null
      onend: (() => void) | null = null
      start() {
        instances.push(this)
      }
      stop() {
        this.onend?.()
      }
    }
    ;(window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = FausseReco

    try {
      expect(dicteeDisponible()).toBe(true)
      const dictee = creerDictee({ onTexte, onEtat })!
      dictee.demarrer()
      expect(onEtat).toHaveBeenCalledWith('ecoute')

      instances[0].onresult?.({
        results: [{ isFinal: true, 0: { transcript: 'Bonjour Mia' } }],
      })
      expect(onTexte).toHaveBeenCalledWith('Bonjour Mia', true)

      dictee.arreter()
    } finally {
      delete (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    }
  })
})

describe('vignettes de collection', () => {
  it('retourne une vignette dédiée par collection connue', () => {
    expect(vignetteCollection('acquisition').traces.length).toBeGreaterThan(0)
    expect(vignetteCollection('ia-generative')).not.toEqual(vignetteCollection('acquisition'))
  })

  it('replie sur le pictogramme article pour une collection inconnue', () => {
    expect(vignetteCollection('inconnue').traces.length).toBeGreaterThan(0)
    expect(vignetteCollection(null)).toEqual(vignetteCollection('inconnue'))
  })
})
