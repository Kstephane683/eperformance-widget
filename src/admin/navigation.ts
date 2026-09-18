/**
 * Registre des modules de la console — SOURCE UNIQUE.
 *
 * La barre latérale, le routeur, le titre de l'en-tête et les tests lisent tous
 * ce fichier : un module ajouté ici est un module atteignable, titré, groupé et
 * testé. C'est ce qui évite la dérive classique « une entrée de menu sans
 * route » ou « une route sans entrée ».
 *
 * STRUCTURE — quatre groupes par INTENTION, pas une liste plate :
 *   · Pilotage       : ce qui se surveille et se mesure ;
 *   · Conversations  : ce qui rentre et demande une réponse ;
 *   · Contenu        : ce dont Mia se sert pour répondre ;
 *   · Réglages       : les accès et l'administration.
 *
 * RÈGLE ABSOLUE (règle produit) — les 27 agents internes n'apparaissent JAMAIS :
 * ni nom, ni rôle, ni compteur. Cette console ne parle que de « Mia » et de
 * « compétences ». Aucun libellé de ce fichier ne doit donc nommer un agent.
 *
 * Les icônes sont des TRACÉS SVG décrits en clair (viewBox 24×24, tracé au
 * `currentColor`) : jamais de `v-html`, jamais d'emoji d'interface (règle n°8).
 */

export type NomModule =
  | 'tableau-de-bord'
  | 'activite'
  | 'performance'
  | 'conversations'
  | 'prospects'
  | 'candidatures'
  | 'connaissances'
  | 'publications'
  | 'competences'
  | 'utilisateurs'
  | 'integrations'

export type IdGroupe = 'pilotage' | 'conversations' | 'contenu' | 'reglages'

/** Compteur affiché en pastille sur une entrée de la barre latérale. */
export type CleBadge = 'conversations_en_attente' | 'candidats_en_attente'

export interface Module {
  /** Nom de route vue-router — identique à l'identifiant du module */
  nom: NomModule
  /** Chemin du routeur à hash (`admin.html#/…`) */
  chemin: string
  /** Libellé de l'entrée de barre latérale et titre du module */
  libelle: string
  /** Sous-titre de l'en-tête : ce que le module montre, en une ligne */
  description: string
  groupe: IdGroupe
  /** Tracés SVG (viewBox 24×24), dessinés au `currentColor` */
  icone: readonly string[]
  /** Compteur éventuel, lu dans les statistiques de la console */
  badge?: CleBadge
}

export interface Groupe {
  id: IdGroupe
  titre: string
  /** Intention du groupe, affichée en info-bulle et lue par les tests */
  intention: string
  modules: Module[]
}

/**
 * Les 11 modules. L'ordre de ce tableau est l'ordre d'affichage : il va du
 * général (ce qui se surveille) au particulier (ce qui se règle).
 */
export const MODULES: readonly Module[] = [
  // ---------------------------------------------------------------- Pilotage
  {
    nom: 'tableau-de-bord',
    chemin: '/tableau-de-bord',
    libelle: 'Tableau de bord',
    description: 'L’état de la conversation client en un écran',
    groupe: 'pilotage',
    icone: ['M4 4h6.5v6.5H4z', 'M13.5 4H20v6.5h-6.5z', 'M4 13.5h6.5V20H4z', 'M13.5 13.5H20V20h-6.5z'],
  },
  {
    nom: 'activite',
    chemin: '/activite',
    libelle: 'Activité',
    description: 'Le fil chronologique de ce qui s’est passé',
    groupe: 'pilotage',
    icone: ['M3 12h3.6L9 5.5l3.4 13L15 12h6'],
  },
  {
    nom: 'performance',
    chemin: '/performance',
    libelle: 'Performance',
    description: 'Résolution, escalade et capture de prospects, mesurées',
    groupe: 'pilotage',
    icone: ['M4 20V11', 'M10 20V4', 'M16 20v-6.5', 'M2.5 20h19'],
  },

  // ----------------------------------------------------------- Conversations
  {
    nom: 'conversations',
    chemin: '/conversations',
    libelle: 'Boîte de réception',
    description: 'Les conversations des visiteurs, et la prise de main humaine',
    groupe: 'conversations',
    badge: 'conversations_en_attente',
    icone: ['M21 12a8 8 0 0 1-8 8H7l-4 3v-5.6A8 8 0 1 1 21 12z'],
  },
  {
    nom: 'prospects',
    chemin: '/prospects',
    libelle: 'Prospects',
    description: 'Les coordonnées laissées par les visiteurs',
    groupe: 'conversations',
    icone: [
      'M4.5 5h15v14h-15z',
      'M12 11.4a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z',
      'M8.6 16.4a3.4 3.4 0 0 1 6.8 0',
    ],
  },
  {
    nom: 'candidatures',
    chemin: '/candidatures',
    libelle: 'Candidatures',
    description: 'Les diagnostics et candidatures reçus du site',
    groupe: 'conversations',
    badge: 'candidats_en_attente',
    icone: [
      'M12 3.5 2.5 8.2 12 13l9.5-4.8L12 3.5z',
      'M6.2 10.6V16c0 1.5 2.6 2.9 5.8 2.9s5.8-1.4 5.8-2.9v-5.4',
    ],
  },

  // ----------------------------------------------------------------- Contenu
  {
    nom: 'connaissances',
    chemin: '/connaissances',
    libelle: 'Base de connaissances',
    description: 'Les collections dont Mia s’appuie pour répondre',
    groupe: 'contenu',
    icone: [
      'M12 6.6C10.4 5.2 8.4 4.5 6 4.5H4v13h2c2.4 0 4.4.7 6 2.1 1.6-1.4 3.6-2.1 6-2.1h2v-13h-2c-2.4 0-4.4.7-6 2.1z',
      'M12 6.6v13.5',
    ],
  },
  {
    nom: 'publications',
    chemin: '/publications',
    libelle: 'Publications',
    description: 'Les articles publiés que Mia peut citer',
    groupe: 'contenu',
    icone: ['M6.5 3h7.2L18.5 7.8V21H6.5z', 'M13.5 3v5h5', 'M9.5 12.5h6M9.5 16h4'],
  },
  {
    nom: 'competences',
    chemin: '/competences',
    libelle: 'Compétences de Mia',
    description: 'Ce que Mia sait faire, par famille de besoin',
    groupe: 'contenu',
    icone: ['M12 3.2l1.9 5.4 5.4 1.9-5.4 1.9L12 17.8l-1.9-5.4L4.7 10.5l5.4-1.9z'],
  },

  // ---------------------------------------------------------------- Réglages
  {
    nom: 'utilisateurs',
    chemin: '/utilisateurs',
    libelle: 'Utilisateurs',
    description: 'Les comptes qui accèdent à la console',
    groupe: 'reglages',
    icone: [
      'M9 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
      'M2.8 20c0-3.3 2.8-5.5 6.2-5.5s6.2 2.2 6.2 5.5',
      'M16.4 5.6a3 3 0 0 1 0 5.8M18 14.8c2.1.6 3.4 2.2 3.4 4.2',
    ],
  },
  {
    nom: 'integrations',
    chemin: '/integrations',
    libelle: 'Intégrations',
    description: 'Le CRM historique et les accès externes',
    groupe: 'reglages',
    icone: [
      'M10.2 13.4a4.4 4.4 0 0 0 6.3 0l2.6-2.6a4.4 4.4 0 0 0-6.3-6.3l-1.4 1.4',
      'M13.8 10.6a4.4 4.4 0 0 0-6.3 0l-2.6 2.6a4.4 4.4 0 0 0 6.3 6.3l1.4-1.4',
    ],
  },
]

/** Titres et intentions des quatre groupes, dans l'ordre d'affichage. */
export const GROUPES: readonly Omit<Groupe, 'modules'>[] = [
  { id: 'pilotage', titre: 'Pilotage', intention: 'Surveiller et mesurer' },
  { id: 'conversations', titre: 'Conversations', intention: 'Répondre à ce qui rentre' },
  { id: 'contenu', titre: 'Contenu', intention: 'Ce dont Mia se sert' },
  { id: 'reglages', titre: 'Réglages', intention: 'Accès et administration' },
]

/** Les modules groupés, dans l'ordre des groupes — ce que lit la barre latérale. */
export const MODULES_PAR_GROUPE: readonly Groupe[] = GROUPES.map((groupe) => ({
  ...groupe,
  modules: MODULES.filter((module) => module.groupe === groupe.id),
}))

/** Module correspondant à un nom de route (undefined si la route n'est pas un module). */
export function moduleParNom(nom: unknown): Module | undefined {
  return MODULES.find((module) => module.nom === nom)
}

/** Premier module : la destination par défaut de la console. */
export const MODULE_PAR_DEFAUT: NomModule = 'conversations'
