/**
 * Tests de la tâche 6.4 — pages publiques (`/application`, `/application/mia`),
 * manifeste et service worker.
 *
 * Ces pages sont du HTML statique : leurs tests lisent les fichiers sources.
 * Deux règles du propriétaire y sont verrouillées :
 *
 *   · les neuf capacités affichées sont EXACTEMENT celles de
 *     `src/data/capacites.ts` (source unique) — un libellé modifié d'un côté
 *     doit l'être des deux, sinon la page vend une capacité que Mia n'a pas ;
 *   · aucun emoji, et aucun terme interne (nom d'agent, persona, prompt) :
 *     seul le prénom Mia est visible.
 */
import { describe, expect, it } from 'vitest'

import { CAPACITES, FAMILLES } from '@/data/capacites'

/**
 * Les fichiers sont lus par Vite (`?raw`) et non par `node:fs` : le typage de
 * l'application n'inclut pas les types Node, et le contrôle `vue-tsc` fait
 * partie du build. `?raw` donne exactement le contenu du fichier, sur disque,
 * au moment du test.
 */
import LANDING from '../../application/mia/index.html?raw'
import PORTAIL from '../../application/index.html?raw'
import MANIFESTE from '../../public/mia-manifest.webmanifest?raw'
import SERVICE_WORKER from '../../public/sw.js?raw'

/** Emoji : plages Unicode d'usage courant (règle n°8 du propriétaire) */
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u

/** Vocabulaire interne qui ne doit jamais atteindre une page publique */
const TERMES_INTERNES = ['sales-discovery', 'discovery coach', 'persona', 'prompt système', 'routage']

/** Le balisage échappe les caractères réservés : on compare la forme échappée */
function echapper(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

describe('Page /application/mia — contenu et conversion', () => {
  it('porte les deux actions attendues, avec la bonne cible', () => {
    expect(LANDING).toContain('Ouvrir Mia')
    expect(LANDING).toContain('Installer l’application')
    expect(LANDING).toContain('href="../../index.html?app=1"')
    expect(LANDING).toContain('data-installer')
  })

  it('affiche les neuf capacités, exactement celles du widget', () => {
    for (const capacite of CAPACITES) {
      expect(LANDING).toContain(echapper(capacite.libelle))
    }
    // Ni plus, ni moins : neuf suggestions, trois familles
    expect(CAPACITES).toHaveLength(9)
    expect(LANDING.match(/data-capacite=/g) ?? []).toHaveLength(9)
    for (const famille of FAMILLES) {
      expect(LANDING).toContain(echapper(famille.titre))
    }
  })

  it('répond aux questions fréquentes avec un balisage et des données structurées cohérents', () => {
    const questions = LANDING.match(/<summary>/g) ?? []
    const jsonLd = LANDING.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    expect(jsonLd).not.toBeNull()
    const donnees = JSON.parse(jsonLd![1])
    const faq = donnees['@graph'].find((n: { '@type': string }) => n['@type'] === 'FAQPage')
    expect(faq).toBeDefined()
    // Autant de questions déclarées que de questions affichées
    expect(faq.mainEntity).toHaveLength(questions.length)
    expect(questions.length).toBeGreaterThanOrEqual(5)
  })

  it('déclare le manifeste, les métadonnées iOS, le canonique et le partage social', () => {
    expect(LANDING).toContain('rel="manifest"')
    expect(LANDING).toContain('rel="canonical"')
    expect(LANDING).toContain('apple-touch-icon')
    expect(LANDING).toContain('og:image')
    expect(LANDING).toContain('name="description"')
    expect(LANDING).toContain('name="robots" content="index,follow')
  })

  it('explique l’installation sur les trois plateformes', () => {
    expect(LANDING).toContain('iPhone et iPad')
    expect(LANDING).toContain('Android')
    expect(LANDING).toContain('Ordinateur')
    expect(LANDING).toContain('data-etapes-installation')
  })

  it('cite la politique de confidentialité et la page cookies du site, sans en inventer', () => {
    expect(LANDING).toContain('https://eperformance.pro/politique-confidentialite.html')
    expect(LANDING).toContain('https://eperformance.pro/cookies.html')
    expect(LANDING).toContain('douze mois')
  })
})

describe('Portail /application', () => {
  it('mène à la page de Mia et à son ouverture directe', () => {
    expect(PORTAIL).toContain('href="./mia/"')
    expect(PORTAIL).toContain('href="../index.html?app=1"')
    expect(PORTAIL).toContain('data-application="mia"')
  })

  it('est prêt à accueillir d’autres applications', () => {
    expect(PORTAIL).toContain('grid-2')
    expect(PORTAIL).toContain('Les prochaines')
  })
})

describe('Règles du propriétaire sur les pages publiques', () => {
  it('n’affiche aucun emoji', () => {
    expect(EMOJI.test(LANDING)).toBe(false)
    expect(EMOJI.test(PORTAIL)).toBe(false)
    expect(EMOJI.test(MANIFESTE)).toBe(false)
  })

  it('ne laisse passer aucun terme interne', () => {
    for (const terme of TERMES_INTERNES) {
      expect(LANDING.toLowerCase()).not.toContain(terme)
      expect(PORTAIL.toLowerCase()).not.toContain(terme)
    }
  })
})

describe('Manifeste de l’application', () => {
  const manifeste = JSON.parse(MANIFESTE)

  it('porte l’identité de l’application, en français', () => {
    expect(manifeste.name).toBe('Mia — assistante ePerformance')
    expect(manifeste.short_name).toBe('Mia')
    expect(manifeste.lang).toBe('fr')
    expect(manifeste.start_url).toContain('index.html')
    expect(manifeste.scope).toBe('./')
    expect(manifeste.display).toBe('standalone')
  })

  it('aligne les couleurs sur les jetons canoniques (thème clair par défaut)', () => {
    expect(manifeste.theme_color).toBe('#fdfcfa') // --bg clair
    expect(manifeste.background_color).toBe('#fdfcfa')
  })

  it('fournit les icônes 192 et 512, dont des maskable', () => {
    const tailles = manifeste.icons.map((i: { sizes: string }) => i.sizes)
    expect(tailles).toContain('192x192')
    expect(tailles).toContain('512x512')
    const maskable = manifeste.icons.filter((i: { purpose: string }) => i.purpose === 'maskable')
    expect(maskable.length).toBeGreaterThanOrEqual(2)
  })
})

describe('Service worker — politique de cache', () => {
  it('n’intercepte jamais ce qui n’est pas de même origine (API de Mia)', () => {
    // L'API Railway est cross-origin : le service worker s'arrête là, donc
    // aucune réponse de Mia ne peut être servie périmée.
    expect(SERVICE_WORKER).toContain('origine !== self.location.origin) return')
  })

  it('ne met jamais en cache la console d’administration ni les chemins /api', () => {
    expect(SERVICE_WORKER).toContain('estAdministration')
    expect(SERVICE_WORKER).toContain('estApiLocale')
    expect(SERVICE_WORKER).toContain('if (estAdministration(requete) || estApiLocale(requete)) return')
  })

  it('ne met en cache que des GET', () => {
    expect(SERVICE_WORKER).toContain("if (requete.method !== 'GET') return")
  })

  it('versionne son cache et purge les versions précédentes à l’activation', () => {
    expect(SERVICE_WORKER).toMatch(/const VERSION = 'mia-v\d+'/)
    expect(SERVICE_WORKER).toContain('noms.filter((nom) => !nom.startsWith(VERSION))')
    expect(SERVICE_WORKER).toContain("caches.delete(nom)")
  })

  it('sert le réseau d’abord pour les navigations et le cache d’abord pour les ressources', () => {
    expect(SERVICE_WORKER).toContain("requete.mode === 'navigate'")
    expect(SERVICE_WORKER).toContain('repondreNavigation')
    expect(SERVICE_WORKER).toContain('repondreStatique')
  })
})
