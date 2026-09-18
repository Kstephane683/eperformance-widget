/**
 * Tests du registre des modules et du routeur de la console (tâche 6.3).
 *
 * Trois propriétés sont verrouillées ici, et ce sont celles qui cassent en
 * silence quand on ajoute un écran :
 *
 *   1. les ONZE modules existent, sont groupés par intention, et chacun a une
 *      route nommée qui lui correspond (et réciproquement) ;
 *   2. les anciens chemins redirigent — un favori de la console ne casse pas ;
 *   3. les RÈGLES DU PROPRIÉTAIRE tiennent : aucun emoji dans l'interface
 *      (règle n°8) et aucun nom d'agent interne dans les libellés.
 */
import { describe, expect, it } from 'vitest'

import {
  GROUPES,
  MODULE_PAR_DEFAUT,
  MODULES,
  MODULES_PAR_GROUPE,
  moduleParNom,
} from '@/admin/navigation'
import { REDIRECTIONS_ANCIENS_CHEMINS, VUES, creerRouteur } from '@/admin/router'

/** Emoji : mêmes plages que le test des pages publiques (règle n°8) */
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u

/** Vocabulaire qui ne doit jamais apparaître dans un libellé de la console */
const TERMES_INTERNES = [
  'sales-coach',
  'discovery coach',
  'agent',
  'persona',
  'prompt',
  'routage',
  'intent',
]

describe('Registre des modules', () => {
  it('expose onze modules, répartis en quatre groupes par intention', () => {
    expect(MODULES).toHaveLength(11)
    expect(MODULES_PAR_GROUPE).toHaveLength(4)
    expect(MODULES_PAR_GROUPE.map((groupe) => groupe.id)).toEqual([
      'pilotage',
      'conversations',
      'contenu',
      'reglages',
    ])
    expect(MODULES_PAR_GROUPE.map((groupe) => groupe.modules.length)).toEqual([3, 3, 3, 2])

    // Chaque module appartient à un groupe déclaré
    for (const module of MODULES) {
      expect(GROUPES.map((groupe) => groupe.id)).toContain(module.groupe)
    }
  })

  it('nomme chaque module une seule fois, avec un chemin unique', () => {
    const noms = MODULES.map((module) => module.nom)
    const chemins = MODULES.map((module) => module.chemin)
    expect(new Set(noms).size).toBe(MODULES.length)
    expect(new Set(chemins).size).toBe(MODULES.length)
    for (const chemin of chemins) expect(chemin.startsWith('/')).toBe(true)
  })

  it('donne à chaque module une icône SVG décrite en clair', () => {
    for (const module of MODULES) {
      expect(module.icone.length).toBeGreaterThan(0)
      for (const trace of module.icone) {
        // Un tracé, jamais un emoji ni un nom d'icône de police
        expect(trace).toMatch(/^[Mm][\s\d.,-]/)
        expect(EMOJI.test(trace)).toBe(false)
      }
    }
  })

  it('résout un module depuis un nom de route, et rien pour une route inconnue', () => {
    expect(moduleParNom('conversations')?.libelle).toBe('Boîte de réception')
    expect(moduleParNom('login')).toBeUndefined()
    expect(moduleParNom(undefined)).toBeUndefined()
    expect(moduleParNom(MODULE_PAR_DEFAUT)).toBeDefined()
  })
})

describe('Routeur de la console', () => {
  it('déclare une route nommée pour chacun des onze modules', () => {
    const routeur = creerRouteur()
    for (const module of MODULES) {
      const route = routeur.getRoutes().find((entree) => entree.name === module.nom)
      expect(route, `route manquante pour ${module.nom}`).toBeDefined()
      expect(route?.path).toBe(module.chemin)
      expect(route?.components).toBeDefined()
      expect(route?.meta.requiresAuth).toBe(true)
    }
    expect(VUES['tableau-de-bord']).toBeDefined()
  })

  it('redirige les anciens chemins vers les modules actuels', async () => {
    const routeur = creerRouteur()
    for (const redirection of REDIRECTIONS_ANCIENS_CHEMINS) {
      await routeur.push(redirection.path)
      expect(routeur.currentRoute.value.name).toBe(redirection.nom)
    }
  })

  it('ramène toute route inconnue sur le module par défaut', async () => {
    const routeur = creerRouteur()
    await routeur.push('/un-chemin-qui-nexiste-pas')
    expect(routeur.currentRoute.value.name).toBe(MODULE_PAR_DEFAUT)

    await routeur.push('/')
    expect(routeur.currentRoute.value.name).toBe(MODULE_PAR_DEFAUT)
  })
})

describe('Règles du propriétaire sur la console', () => {
  it('n’affiche aucun emoji dans les libellés', () => {
    for (const module of MODULES) {
      expect(EMOJI.test(module.libelle)).toBe(false)
      expect(EMOJI.test(module.description)).toBe(false)
    }
    for (const groupe of GROUPES) {
      expect(EMOJI.test(groupe.titre)).toBe(false)
      expect(EMOJI.test(groupe.intention)).toBe(false)
    }
  })

  it('ne nomme aucun agent interne dans les libellés', () => {
    for (const module of MODULES) {
      const texte = `${module.libelle} ${module.description}`.toLowerCase()
      for (const terme of TERMES_INTERNES) {
        expect(texte, `${module.nom} contient « ${terme} »`).not.toContain(terme)
      }
    }
  })
})
