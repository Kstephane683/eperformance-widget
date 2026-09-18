/**
 * Dictée vocale — Web Speech API (`SpeechRecognition`), sans dépendance npm.
 *
 * Navigateurs : Chrome/Edge/Safari exposent `webkitSpeechRecognition` ;
 * Firefox ne l'expose pas. Quand l'API est absente, `creerDictee()` retourne
 * null : le bouton micro est alors annoncé `aria-disabled` avec une infobulle
 * explicite (dégradation propre, aucun bouton factice).
 *
 * L'autorisation micro est demandée par le navigateur au premier `start()` :
 * une erreur (`not-allowed`) remonte via `onErreur`, jamais en exception.
 */

export type EtatDictee = 'inactif' | 'ecoute' | 'erreur'

export interface DicteeHandlers {
  /** Transcription (résultats intermédiaires inclus) */
  onTexte: (texte: string, definitif: boolean) => void
  onEtat: (etat: EtatDictee, message?: string) => void
}

export interface Dictee {
  demarrer: () => void
  arreter: () => void
  /** L'API est-elle disponible dans ce navigateur ? */
  readonly disponible: boolean
}

/* Les types DOM de `SpeechRecognition` ne sont pas encore dans lib.dom :
   on décrit le strict nécessaire localement (aucun `any` implicite). */
interface SpeechRecognitionAlternative {
  transcript: string
}

interface SpeechRecognitionResult {
  isFinal: boolean
  0: SpeechRecognitionAlternative
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResult>
}

interface SpeechRecognitionErrorEventLike {
  error?: string
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}

type ConstructeurDictee = new () => SpeechRecognitionLike

function constructeur(): ConstructeurDictee | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: ConstructeurDictee
    webkitSpeechRecognition?: ConstructeurDictee
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** L'API est-elle utilisable ici ? (testable sans navigateur) */
export function dicteeDisponible(): boolean {
  return constructeur() !== null
}

/** Message d'indisponibilité, affiché en infobulle du bouton micro */
export const DICTEE_INDISPONIBLE =
  'La dictée vocale n’est pas disponible dans ce navigateur (Chrome, Edge ou Safari requis).'

export function creerDictee(handlers: DicteeHandlers): Dictee | null {
  const Reco = constructeur()
  if (!Reco) return null

  const reco = new Reco()
  reco.lang = 'fr-FR'
  reco.continuous = false
  reco.interimResults = true

  let actif = false

  reco.onresult = (event) => {
    let transcription = ''
    let definitif = false
    for (let i = 0; i < event.results.length; i += 1) {
      const resultat = event.results[i]
      transcription += resultat[0]?.transcript ?? ''
      if (resultat.isFinal) definitif = true
    }
    handlers.onTexte(transcription.trim(), definitif)
  }

  reco.onerror = (event) => {
    actif = false
    const cle = event?.error ?? ''
    const message =
      cle === 'not-allowed' || cle === 'service-not-allowed'
        ? 'Accès au micro refusé. Autorisez le microphone pour dicter votre message.'
        : cle === 'no-speech'
          ? 'Aucune parole détectée.'
          : 'La dictée s’est interrompue. Réessayez.'
    handlers.onEtat('erreur', message)
  }

  reco.onend = () => {
    if (actif) {
      actif = false
      handlers.onEtat('inactif')
    }
  }

  return {
    disponible: true,
    demarrer() {
      if (actif) return
      try {
        reco.start()
        actif = true
        handlers.onEtat('ecoute')
      } catch {
        // start() lève si un enregistrement est déjà en cours
        actif = false
        handlers.onEtat('erreur', 'La dictée est déjà en cours.')
      }
    },
    arreter() {
      if (!actif) return
      actif = false
      try {
        reco.stop()
      } catch {
        /* déjà arrêtée */
      }
      handlers.onEtat('inactif')
    },
  }
}
