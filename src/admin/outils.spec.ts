/**
 * Tests des outils de la console (tâche 6.3) : formatage, identité lue dans le
 * jeton, recherche globale, thème.
 *
 * Ces fonctions sont pures pour pouvoir être testées sans navigateur ni
 * serveur — c'est ce qui rend la recherche testable avec des accents, un jeton
 * illisible et un thème mémorisé.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { lireIdentite, initialesDe } from '@/admin/identite'
import { chercherDansLaConsole, normaliser } from '@/admin/recherche'
import { FAMILLES } from '@/data/capacites'
import {
  dateCourteOuTiret,
  heure,
  libelleNiveau,
  libelleStatutCandidature,
  libelleStatutConversation,
  nomAffichage,
  nombre,
  pourcentage,
  tonScore,
  tonStatutCandidature,
  tonStatutConversation,
  tronquer,
} from '@/admin/format'
import {
  appliquerChoix,
  CLE_THEME,
  lireChoix,
  synchroniserCouleurBarre,
  themeApplique,
  themeSysteme,
} from '@/admin/theme'
import type { AdminCandidat, AdminConversationSummary, AdminUser } from '@/admin/api'

// ============================================================
// Identité — lecture de la charge utile du JWT
// ============================================================

/** Construit un JWT factice : seule la charge utile compte pour l'affichage. */
function jetonFactice(charge: Record<string, unknown>): string {
  const base64url = (valeur: string) => {
    // Un JWT réel encode des OCTETS UTF-8 : `btoa` seul refuse « é ».
    const octets = new TextEncoder().encode(valeur)
    const binaire = Array.from(octets, (octet) => String.fromCharCode(octet)).join('')
    return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  return `${base64url('{"alg":"HS256"}')}.${base64url(JSON.stringify(charge))}.signature`
}

describe('Identité de l’opérateur', () => {
  it('lit le nom, l’email et le rôle dans la charge utile', () => {
    const identite = lireIdentite(
      jetonFactice({ email: 'stephane@eperformance.pro', nom: 'Stéphane Ballo', role: 'admin' }),
    )
    expect(identite.email).toBe('stephane@eperformance.pro')
    expect(identite.nom).toBe('Stéphane Ballo')
    expect(identite.role).toBe('admin')
    expect(identite.initiales).toBe('SB')
  })

  it('retombe sur le sujet du jeton quand le courriel n’y est pas', () => {
    const identite = lireIdentite(jetonFactice({ sub: 'admin@eperformance.pro' }))
    expect(identite.email).toBe('admin@eperformance.pro')
    expect(identite.initiales).toBe('AE')
  })

  it('reste neutre sur un jeton absent ou illisible, sans jamais lever', () => {
    for (const jeton of [null, '', 'pas-un-jeton', 'a.b.c', 'a.%%%.c']) {
      const identite = lireIdentite(jeton)
      expect(identite.initiales).toBe('·')
      expect(identite.email).toBeNull()
    }
  })

  it('calcule des initiales utilisables pour un mot seul', () => {
    expect(initialesDe('Stéphane')).toBe('ST')
    expect(initialesDe('  ')).toBe('·')
    expect(initialesDe('a@b.fr')).toBe('AB')
  })
})

// ============================================================
// Formatage
// ============================================================

describe('Formatage', () => {
  it('exprime une proportion sans jamais produire NaN', () => {
    expect(pourcentage(1, 2)).toBe('50 %')
    expect(pourcentage(0, 0)).toBe('0 %')
    expect(pourcentage(5, 0)).toBe('0 %')
    expect(nombre(1234)).toMatch(/1\s?234/)
  })

  it('tronque en gardant la longueur demandée', () => {
    expect(tronquer('abcdef', 4)).toBe('abc…')
    expect(tronquer('abc', 10)).toBe('abc')
  })

  it('formate les dates et les heures en français, ou rend un tiret', () => {
    expect(dateCourteOuTiret(null)).toBe('—')
    expect(dateCourteOuTiret('n’importe quoi')).toBe('—')
    expect(dateCourteOuTiret('2026-09-18T10:00:00Z')).toMatch(/2026/)
    expect(heure(null)).toBe('')
    expect(heure('2026-09-18T10:32:00Z')).toMatch(/\d{1,2}:\d{2}/)
  })

  it('nomme un visiteur sans nom par son identifiant court', () => {
    expect(nomAffichage('Awa', 'conv_123456')).toBe('Awa')
    expect(nomAffichage(null, 'conv_abcdef')).toBe('Visiteur abcdef')
    expect(nomAffichage('   ', 'conv_abcdef')).toBe('Visiteur abcdef')
  })

  it('donne un mot et un ton à chaque statut de conversation', () => {
    expect(libelleStatutConversation('escalated', false)).toBe('En attente')
    expect(libelleStatutConversation('escalated', true)).toBe('Conseiller actif')
    expect(tonStatutConversation('escalated', false)).toBe('alerte')
    expect(tonStatutConversation('escalated', true)).toBe('succes')
    expect(tonStatutConversation('active', false)).toBe('info')
    expect(tonStatutConversation('resolved', false)).toBe('neutre')
  })

  it('donne un mot et un ton à chaque statut de candidature', () => {
    expect(libelleStatutCandidature('en_attente')).toBe('En attente')
    expect(libelleStatutCandidature(null)).toBe('—')
    expect(tonStatutCandidature('accepte')).toBe('succes')
    expect(tonStatutCandidature('alumni')).toBe('info')
    expect(libelleNiveau('acceleration')).toBe('Accélération')
    expect(libelleNiveau(null)).toBe('—')
  })

  it('classe un score de diagnostic en trois tons', () => {
    expect(tonScore(80)).toBe('succes')
    expect(tonScore(55)).toBe('info')
    expect(tonScore(10)).toBe('neutre')
  })
})

// ============================================================
// Recherche globale
// ============================================================

const CONVERSATION: AdminConversationSummary = {
  conversation_id: 'conv_000001',
  site_id: 'eperformance_vitrine',
  status: 'escalated',
  human_active: false,
  assigned_agent: null,
  lead_captured: true,
  lead_name: 'Awa Traoré',
  lead_phone: '+225 01 51 17 06 66',
  message_count: 6,
  last_message: 'Je cherche à développer mon activité',
  last_message_role: 'user',
  created_at: '2026-09-17T09:00:00Z',
  last_message_at: '2026-09-18T09:00:00Z',
}

const CANDIDAT: AdminCandidat = {
  id: 12,
  nom: 'Ibrahim Koné',
  email: 'ibrahim@exemple.fr',
  whatsapp: null,
  entreprise: 'Kone Conseil',
  secteur: 'Conseil',
  score: 72,
  statut: 'en_attente',
  niveau_accompagnement: 'croissance',
  created_at: '2026-09-15T09:00:00Z',
}

const UTILISATEUR: AdminUser = {
  id: 3,
  email: 'stephane@eperformance.pro',
  nom: 'Stéphane Ballo',
  role: 'admin',
  is_active: true,
  last_login: '2026-09-18T08:00:00Z',
  created_at: '2026-01-01T08:00:00Z',
}

const SOURCES = {
  conversations: [CONVERSATION],
  candidats: [CANDIDAT],
  utilisateurs: [UTILISATEUR],
}

describe('Recherche globale', () => {
  it('ignore la casse et les accents', () => {
    expect(normaliser('Café ÉÈÀ')).toBe('cafe eea')
    const resultats = chercherDansLaConsole('awa traore', SOURCES)
    expect(resultats[0]?.titre).toBe('Awa Traoré')
  })

  it('ne cherche pas en dessous de deux caractères', () => {
    expect(chercherDansLaConsole('a', SOURCES)).toHaveLength(0)
    expect(chercherDansLaConsole('  ', SOURCES)).toHaveLength(0)
  })

  it('cherche dans les quatre sources de la console', () => {
    expect(chercherDansLaConsole('traore', SOURCES)[0]?.rubrique).toBe('Conversations')
    expect(chercherDansLaConsole('kone', SOURCES)[0]?.rubrique).toBe('Candidatures')
    expect(chercherDansLaConsole('stephane', SOURCES)[0]?.rubrique).toBe('Utilisateurs')
    expect(chercherDansLaConsole('seo', SOURCES).length).toBeGreaterThan(0)
    expect(chercherDansLaConsole('automatisation', SOURCES).length).toBeGreaterThan(0)
  })

  it('mène au module concerné, avec le filtre dans l’URL', () => {
    const conversation = chercherDansLaConsole('awa', SOURCES)[0]
    expect(conversation?.vers.nom).toBe('conversations')
    expect(conversation?.vers.query?.q).toBe('Awa Traoré')

    const candidature = chercherDansLaConsole('ibrahim', SOURCES)[0]
    expect(candidature?.vers.nom).toBe('candidatures')

    const utilisateur = chercherDansLaConsole('stephane', SOURCES)[0]
    expect(utilisateur?.vers.nom).toBe('utilisateurs')
  })

  it('ne laisse jamais fuir une clé de compétence dans un résultat', () => {
    // Les résultats « compétences » affichent le libellé du besoin et sa
    // famille — jamais la clé d'intent, qui est la seule chose que le backend
    // interprète (mapping intent → agent, jamais exposé).
    const libelles = new Set(FAMILLES.flatMap((f) => f.capacites.map((c) => c.libelle)))
    const familles = new Set(FAMILLES.map((f) => f.titre))
    const resultats = chercherDansLaConsole('automatisation', SOURCES).filter((r) =>
      r.rubrique.startsWith('Compétences'),
    )
    expect(resultats.length).toBeGreaterThan(0)
    for (const resultat of resultats) {
      expect(libelles.has(resultat.titre)).toBe(true)
      expect(familles.has(resultat.detail)).toBe(true)
      for (const terme of ['sales', 'coach', 'persona', 'intent', 'agent']) {
        expect(resultat.titre.toLowerCase()).not.toContain(terme)
      }
    }
  })
})

// ============================================================
// Thème
// ============================================================

describe('Thème de la console', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.head.querySelector('meta[name="theme-color"]')?.remove()
  })

  it('part sur « système » quand rien n’a été choisi', () => {
    expect(lireChoix()).toBe('systeme')
  })

  it('mémorise un choix explicite sous la clé du contrat C4', () => {
    appliquerChoix('sombre')
    expect(localStorage.getItem(CLE_THEME)).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(lireChoix()).toBe('sombre')

    appliquerChoix('clair')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(lireChoix()).toBe('clair')
  })

  it('revient au suivi du système quand on choisit « Système »', () => {
    appliquerChoix('sombre')
    appliquerChoix('systeme')
    expect(localStorage.getItem(CLE_THEME)).toBeNull()
    expect(document.documentElement.getAttribute('data-theme')).toBe(themeSysteme())
    expect(themeApplique()).toBe(themeSysteme())
  })

  it('n’écrit dans le document aucune couleur qui ne vienne d’un jeton', () => {
    // Dans jsdom les feuilles ne sont pas résolues : `--bg` est vide, donc
    // aucune valeur ne doit être écrite — un `<meta>` vide vaut mieux qu'une
    // couleur inventée.
    appliquerChoix('clair')
    const meta = document.head.querySelector('meta[name="theme-color"]')
    expect(meta).toBeNull()

    // Avec un jeton résolu (ce que fait le navigateur), la valeur écrite est
    // EXACTEMENT celle de `--bg`.
    const espion = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ getPropertyValue: () => ' #fdfcfa ' } as unknown as CSSStyleDeclaration)
    synchroniserCouleurBarre('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(
      document.head.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    ).toBe('#fdfcfa')
    espion.mockRestore()
  })
})
