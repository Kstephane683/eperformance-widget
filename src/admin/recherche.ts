/**
 * Recherche globale de la console.
 *
 * Fonction PURE : on lui donne un terme et les jeux de données déjà chargés,
 * elle rend des résultats groupés. Aucun accès réseau ici — les sources sont
 * fournies par l'appelant (store de la console, index embarqué du blog), ce qui
 * rend la recherche testable sans serveur et sans attente.
 *
 * La recherche est insensible à la casse ET AUX ACCENTS (« cafe » trouve
 * « café ») : un opérateur qui tape vite ne met pas les accents, et une
 * recherche qui rate un résultat à cause d'un accent est une recherche cassée.
 *
 * Aucun résultat ne nomme un agent : la seule entité interne visible est Mia.
 */

import { FAMILLES } from '@/data/capacites'
import { INDEX_EMBARQUE } from '@/stores/blog'
import type { AdminCandidat, AdminConversationSummary, AdminUser } from './api'
import type { NomModule } from './navigation'

export interface SourcesRecherche {
  conversations: AdminConversationSummary[]
  candidats: AdminCandidat[]
  utilisateurs: AdminUser[]
}

export interface Resultat {
  /** Identifiant stable (sert de clé de liste et d'`id` ARIA) */
  id: string
  /** Titre du résultat — ce que l'opérateur reconnaît */
  titre: string
  /** Détail : de quoi lever le doute entre deux homonymes */
  detail: string
  /** Rubrique d'origine, affichée en sur-titre de groupe */
  rubrique: string
  /** Destination interne (module + filtre) */
  vers: { nom: NomModule; query?: Record<string, string> }
  /** Destination externe (article publié) — exclusive de `vers` */
  urlExterne?: string
}

const MAX_PAR_RUBRIQUE = 5
const MAX_TOTAL = 14

/** Minuscules sans accents — « Café » → « cafe ». */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function correspond(terme: string, champs: Array<string | null | undefined>): boolean {
  return champs.some((champ) => typeof champ === 'string' && normaliser(champ).includes(terme))
}

/** Recherche dans les conversations et les prospects qu'elles contiennent. */
function chercherConversations(
  terme: string,
  conversations: AdminConversationSummary[],
): Resultat[] {
  return conversations
    .filter((c) =>
      correspond(terme, [c.lead_name, c.lead_phone, c.last_message, c.conversation_id, c.site_id]),
    )
    .slice(0, MAX_PAR_RUBRIQUE)
    .map((c) => ({
      id: `conversation-${c.conversation_id}`,
      titre: c.lead_name ?? `Visiteur ${c.conversation_id.slice(-6)}`,
      detail:
        c.lead_phone ??
        c.last_message ??
        `${String(c.message_count)} message(s) — ${c.site_id}`,
      rubrique: 'Conversations',
      vers: { nom: 'conversations', query: { q: c.lead_name ?? c.conversation_id } },
    }))
}

function chercherCandidats(terme: string, candidats: AdminCandidat[]): Resultat[] {
  return candidats
    .filter((c) => correspond(terme, [c.nom, c.email, c.whatsapp, c.entreprise, c.secteur]))
    .slice(0, MAX_PAR_RUBRIQUE)
    .map((c) => ({
      id: `candidat-${String(c.id)}`,
      titre: c.nom,
      detail: [c.email, c.entreprise].filter((v) => typeof v === 'string' && v).join(' · '),
      rubrique: 'Candidatures',
      vers: { nom: 'candidatures', query: { q: c.nom } },
    }))
}

function chercherUtilisateurs(terme: string, utilisateurs: AdminUser[]): Resultat[] {
  return utilisateurs
    .filter((u) => correspond(terme, [u.email, u.nom, u.role]))
    .slice(0, MAX_PAR_RUBRIQUE)
    .map((u) => ({
      id: `utilisateur-${String(u.id)}`,
      titre: u.nom ?? u.email,
      detail: u.email,
      rubrique: 'Utilisateurs',
      vers: { nom: 'utilisateurs', query: { q: u.email } },
    }))
}

/** Publications : titres, descriptions et collections de l'index embarqué. */
function chercherPublications(terme: string): Resultat[] {
  return INDEX_EMBARQUE.articles
    .filter((a) => correspond(terme, [a.titre, a.description, a.collection_titre, ...(a.tags ?? [])]))
    .slice(0, MAX_PAR_RUBRIQUE)
    .map((a) => ({
      id: `publication-${a.slug}`,
      titre: a.titre,
      detail: a.collection_titre ?? 'Article publié',
      rubrique: 'Publications',
      vers: { nom: 'publications' as NomModule, query: { q: a.titre } },
      urlExterne: a.url,
    }))
}

/** Compétences de Mia : les libellés des capacités, jamais les clés d'intent. */
function chercherCompetences(terme: string): Resultat[] {
  const resultats: Resultat[] = []
  for (const famille of FAMILLES) {
    for (const capacite of famille.capacites) {
      if (!correspond(terme, [capacite.libelle, famille.titre])) continue
      resultats.push({
        id: `capacite-${capacite.intent}`,
        titre: capacite.libelle,
        detail: famille.titre,
        rubrique: 'Compétences de Mia',
        vers: { nom: 'competences', query: { q: capacite.libelle } },
      })
      if (resultats.length >= MAX_PAR_RUBRIQUE) return resultats
    }
  }
  return resultats
}

/**
 * Résultats groupés par rubrique, dans l'ordre de pertinence d'affichage :
 * ce qui vient de la conversation d'abord, le contenu éditorial ensuite.
 */
export function chercherDansLaConsole(terme: string, sources: SourcesRecherche): Resultat[] {
  const recherche = normaliser(terme.trim())
  if (recherche.length < 2) return []

  const groupes: Resultat[][] = [
    chercherConversations(recherche, sources.conversations),
    chercherCandidats(recherche, sources.candidats),
    chercherUtilisateurs(recherche, sources.utilisateurs),
    chercherPublications(recherche),
    chercherCompetences(recherche),
  ]
  return groupes.flat().slice(0, MAX_TOTAL)
}
