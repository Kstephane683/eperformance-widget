/**
 * Son de notification discret à la réception d'une réponse agent
 * (héritage v6.0 : "Sound on par défaut"). Web Audio API — aucun fichier
 * externe, aucune dépendance. Silencieux si l'API est indisponible
 * (jsdom, navigateurs très anciens) ou bloquée avant interaction.
 */

let audioContext: AudioContext | null = null

function getContext(): AudioContext | null {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    audioContext ??= new Ctor()
    // Contexte suspendu jusqu'à la première interaction — on tente la reprise
    if (audioContext.state === 'suspended') {
      void audioContext.resume()
    }
    return audioContext
  } catch {
    return null
  }
}

/** Double bip doux descendant (La → Mi), ~0.35s, volume discret */
export function playNotificationSound(): void {
  const ctx = getContext()
  if (!ctx || ctx.state !== 'running') return

  const now = ctx.currentTime
  const notes: Array<{ freq: number; at: number }> = [
    { freq: 880, at: 0 }, // La5
    { freq: 659.25, at: 0.12 }, // Mi5
  ]

  for (const { freq, at } of notes) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, now + at)
    gain.gain.exponentialRampToValueAtTime(0.06, now + at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.22)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + at)
    osc.stop(now + at + 0.25)
  }
}
