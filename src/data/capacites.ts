/**
 * Les neuf capacités de Mia — source unique des suggestions (A.8) et de
 * l'onglet Aide (A.9).
 *
 * RÈGLE ABSOLUE (A.6) : ce fichier ne contient AUCUN nom d'agent. Le libellé
 * dit au visiteur ce que Mia sait faire ; la clé `intent` est une étiquette
 * opaque que seul le backend sait interpréter (mapping intent → agent dans
 * `AgentRouter.INTENT_TO_AGENT_MAP`, jamais exposé). Le widget envoie
 * `[intent:<clé>] <libellé>` ; le backend retire le préfixe avant tout
 * affichage, tout enregistrement et tout appel LLM.
 *
 * Les icônes sont des tracés SVG décrits en clair (jamais de `v-html`, jamais
 * d'emoji d'interface) : la règle du design system (6.2-bis) est conservée.
 */

export interface Capacite {
  /** Clé d'intent — opaque côté front, interprétée par le backend uniquement */
  intent: string
  /** Libellé affiché et envoyé (c'est le message que Mia reçoit) */
  libelle: string
  /** Tracés SVG (viewBox 24×24) de la vignette */
  traces: readonly string[]
}

export interface FamilleCapacites {
  /** Titre de la famille, affiché comme sur-titre de groupe */
  titre: string
  capacites: readonly Capacite[]
}

/**
 * Les trois familles. L'ordre est celui de la spécification A.8 :
 * « Développer mon activité » (3), « Visibilité & Acquisition » (4),
 * « Automatisation & IA » (2).
 */
export const FAMILLES: readonly FamilleCapacites[] = [
  {
    titre: 'Développer mon activité',
    capacites: [
      {
        intent: 'clients',
        libelle: 'Trouver plus de clients',
        traces: [
          'M12 4.2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
          'M5 20.2a7 7 0 0 1 14 0',
          'M19.2 8.5v4.4M21.4 10.7h-4.4',
        ],
      },
      {
        intent: 'mlm',
        libelle: 'Développer mon MLM / parrainage',
        traces: [
          'M9 4.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
          'M15.5 6.2a2.6 2.6 0 1 1 0 5.2',
          'M3.5 19.6a5.5 5.5 0 0 1 11 0',
          'M16.2 14.6a5 5 0 0 1 4.3 5',
        ],
      },
      {
        intent: 'ventes',
        libelle: 'Améliorer mes ventes',
        traces: ['M4 19.5V13M9.6 19.5V8.5M15.2 19.5v-5M20.8 19.5V5', 'M3 21h18'],
      },
    ],
  },
  {
    titre: 'Visibilité & Acquisition',
    capacites: [
      {
        intent: 'site_web',
        libelle: 'Créer un site web qui convertit',
        traces: ['M3.5 5.5h17v13h-17z', 'M3.5 9.5h17', 'M7 13h10'],
      },
      {
        intent: 'seo',
        libelle: 'Améliorer mon référencement',
        traces: ['M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z', 'M15.8 15.8 20 20'],
      },
      {
        intent: 'ads',
        libelle: 'Lancer une campagne publicitaire',
        traces: ['M4 9.5v5h3l6 4V5.5l-6 4z', 'M17 8.5a5 5 0 0 1 0 7', 'M19.5 6a8.5 8.5 0 0 1 0 12'],
      },
      {
        intent: 'social',
        libelle: 'Gérer mes réseaux sociaux',
        traces: [
          'M18 5.5a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z',
          'M6 9.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z',
          'M18 13.7a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z',
          'M8.2 11 15.8 8.4M8.2 13 15.8 15.6',
        ],
      },
    ],
  },
  {
    titre: 'Automatisation & IA',
    capacites: [
      {
        intent: 'ia_auto',
        libelle: 'Exploiter l’IA et l’automatisation',
        traces: ['M12 4.2l1.7 4.3 4.3 1.7-4.3 1.7L12 16.2l-1.7-4.3L6 10.2l4.3-1.7z', 'M18.5 16.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z'],
      },
      {
        intent: 'funnel',
        libelle: 'Optimiser mon tunnel de conversion',
        traces: ['M4 5.5h16l-6 6.5v6l-4 2v-8z'],
      },
    ],
  },
]

/** Les neuf capacités à plat (ordre d'affichage) */
export const CAPACITES: readonly Capacite[] = FAMILLES.flatMap((f) => f.capacites)

/** Message envoyé à Mia au clic — contrat A.8, retiré côté backend avant usage */
export function payloadSuggestion(capacite: Capacite): string {
  return `[intent:${capacite.intent}] ${capacite.libelle}`
}

/** Retrouve une capacité par sa clé d'intent (onglet Aide, tests) */
export function capaciteParIntent(intent: string): Capacite | undefined {
  return CAPACITES.find((c) => c.intent === intent)
}
