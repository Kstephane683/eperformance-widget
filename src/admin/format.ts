/**
 * Formatages partagés de la console — une seule définition par question.
 *
 * Les trois vues qui affichaient une date relative, un score ou un statut en
 * avaient chacune leur copie : trois occasions de diverger. Tout ce qui est
 * commun vit ici, et les libellés de statut sont les MÊMES dans la liste, dans
 * le détail et dans les pastilles de notification.
 *
 * Les dates relatives viennent de `@/helpers/relativeTime` (déjà utilisée par
 * le widget) : aucune dépendance nouvelle, aucun format réinventé.
 */

import { tempsRelatif } from '@/helpers/relativeTime'

/** Nombre au format français (séparateur de milliers). */
export function nombre(valeur: number): string {
  return new Intl.NumberFormat('fr-FR').format(valeur)
}

/** « 42 % » — 0 % quand le total est nul (jamais « NaN % »). */
export function pourcentage(part: number, total: number): string {
  if (total <= 0) return '0 %'
  return `${Math.round((part / total) * 100)} %`
}

/** Tronque à `max` caractères, points de suspension compris. */
export function tronquer(texte: string, max: number): string {
  return texte.length > max ? `${texte.slice(0, max - 1)}…` : texte
}

/** Date relative, ou « — » si absente/invalide (les vues affichent un tiret). */
export function tempsRelatifOuTiret(iso: string | null | undefined): string {
  return tempsRelatif(iso) || '—'
}

/** « 16 sept. 2026 » — date absolue, pour les créations et les articles. */
export function dateCourteOuTiret(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** « 16 sept. » — date courte sans année (listes). */
export function dateJourMois(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** « 14:32 » — heure locale d'un message. */
export function heure(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** Nom affiché d'une conversation : le nom du prospect, sinon l'identifiant court. */
export function nomAffichage(nomProspect: string | null, identifiant: string): string {
  if (nomProspect && nomProspect.trim().length > 0) return nomProspect.trim()
  return `Visiteur ${identifiant.slice(-6)}`
}

// ============================================================
// STATUTS — un mot et une classe, définis une fois
// ============================================================

export type TonStatut = 'succes' | 'alerte' | 'info' | 'neutre'

/** Libellé du statut d'une conversation (`AdminConversationStatus`). */
export function libelleStatutConversation(statut: string, conseillerActif: boolean): string {
  if (statut === 'escalated') return conseillerActif ? 'Conseiller actif' : 'En attente'
  if (statut === 'active') return 'Active'
  if (statut === 'resolved') return 'Résolue'
  if (statut === 'abandoned') return 'Abandonnée'
  return statut
}

/** Ton (couleur d'état) du statut d'une conversation. */
export function tonStatutConversation(statut: string, conseillerActif: boolean): TonStatut {
  if (statut === 'escalated') return conseillerActif ? 'succes' : 'alerte'
  if (statut === 'active') return 'info'
  return 'neutre'
}

const LIBELLES_CANDIDATURE: Record<string, string> = {
  en_attente: 'En attente',
  accepte: 'Accepté',
  refuse: 'Refusé',
  alumni: 'Alumni',
}

export function libelleStatutCandidature(statut: string | null): string {
  if (!statut) return '—'
  return LIBELLES_CANDIDATURE[statut] ?? statut
}

export function tonStatutCandidature(statut: string | null): TonStatut {
  if (statut === 'accepte') return 'succes'
  if (statut === 'en_attente') return 'alerte'
  if (statut === 'alumni') return 'info'
  return 'neutre'
}

const LIBELLES_NIVEAU: Record<string, string> = {
  essentielle: 'Essentielle',
  croissance: 'Croissance',
  acceleration: 'Accélération',
}

export function libelleNiveau(niveau: string | null): string {
  if (!niveau) return '—'
  return LIBELLES_NIVEAU[niveau] ?? niveau
}

/** Ton d'un score de diagnostic : 70 et plus = chaud, 40 et plus = tiède. */
export function tonScore(score: number): TonStatut {
  if (score >= 70) return 'succes'
  if (score >= 40) return 'info'
  return 'neutre'
}
