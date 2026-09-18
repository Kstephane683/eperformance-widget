/**
 * Dates relatives en français — « il y a X minutes », « hier »…
 *
 * Sert à deux endroits :
 * - liste des conversations (aperçu + date du dernier message) ;
 * - signature sous chaque message de la conversation.
 *
 * Aucune dépendance : Intl.RelativeTimeFormat est natif (aucun paquet npm).
 */

const DIVISIONS: Array<{
  /** Au-delà de ce nombre de secondes, on passe à l'unité suivante */
  seuil: number
  unite: Intl.RelativeTimeFormatUnit
  /** Secondes par unité (60 pour une minute, 3600 pour une heure…) */
  facteur: number
}> = [
  { seuil: 60, unite: 'second', facteur: 1 },
  { seuil: 3600, unite: 'minute', facteur: 60 },
  { seuil: 86400, unite: 'hour', facteur: 3600 },
]

function formateur(): Intl.RelativeTimeFormat | null {
  if (typeof Intl === 'undefined' || typeof Intl.RelativeTimeFormat !== 'function') {
    return null
  }
  return new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
}

/**
 * « à l'instant » / « il y a 5 minutes » / « hier » / « 12 sept. »
 * Une date absente ou invalide retourne une chaîne vide (jamais « Invalid Date »).
 *
 * @param reference instant de comparaison (par défaut maintenant) — permet à
 *   une vue de recalculer les libellés quand son horloge avance
 */
export function tempsRelatif(
  valeur: string | Date | null | undefined,
  reference: number = Date.now(),
): string {
  if (!valeur) return ''
  const date = valeur instanceof Date ? valeur : new Date(valeur)
  if (Number.isNaN(date.getTime())) return ''

  const secondes = (reference - date.getTime()) / 1000

  // Tolérance de 60 s vers l'avant : un message qui vient d'être créé peut
  // porter un horodatage de quelques millisecondes postérieur à l'horloge de
  // la vue (il est écrit après le montage du fil), et un horodatage serveur
  // peut dériver de quelques secondes. Sans cette marge, un message « à
  // l'instant » s'affichait comme une date en clair.
  if (secondes > -60 && secondes < 45) return "à l'instant"

  if (secondes < 0) {
    // Date réellement à venir (article programmé) : affichée en clair plutôt
    // que « dans 3 jours », plus lisible dans une liste éditoriale.
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  if (secondes < 86400) {
    const division = DIVISIONS.find((d) => secondes < d.seuil) ?? DIVISIONS[2]
    const valeur = Math.round(secondes / division.facteur)
    return formateur()?.format(-valeur, division.unite) ?? `${valeur} ${division.unite}`
  }

  const jours = Math.floor(secondes / 86400)
  if (jours === 1) return 'hier'
  if (jours < 7) return formateur()?.format(-jours, 'day') ?? `${jours} j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** « 16 sept. 2026 » — date éditoriale d'un article (jamais relative) */
export function dateCourte(valeur: string | null | undefined): string {
  if (!valeur) return ''
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
