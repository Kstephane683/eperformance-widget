/**
 * Tests du store blog — source réseau, repli embarqué, tri et recherche.
 * Le repli est ce qui rend les onglets Aide/Actualités utilisables hors ligne.
 */
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { estIndexValide, filtrerArticles, INDEX_EMBARQUE, trierParDate, useBlogStore } from '@/stores/blog'
import type { BlogArticle } from '@/types/blog'

function article(partiel: Partial<BlogArticle>): BlogArticle {
  return {
    slug: 'slug',
    titre: 'Titre',
    description: 'Description',
    collection: 'acquisition',
    collection_titre: 'Acquisition',
    date: '2026-09-16T09:00:00+00:00',
    url: 'https://blog.eperformance.pro/articles/slug/',
    tags: [],
    image: null,
    ...partiel,
  }
}

function indexReseau() {
  return {
    genere_le: '2026-09-17T00:00:00Z',
    source: 'https://blog.eperformance.pro/',
    collections: [{ slug: 'acquisition', titre: 'Acquisition', url: null, nombre: 2 }],
    articles: [
      article({ slug: 'ancien', date: '2026-09-01T09:00:00+00:00' }),
      article({ slug: 'recent', date: '2026-09-30T09:00:00+00:00' }),
    ],
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.unstubAllGlobals()
})

describe('store blog — chargement de l’index', () => {
  it('charge l’index par le réseau quand il est disponible', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => indexReseau() }),
    )
    const blog = useBlogStore()

    await blog.load()

    expect(blog.source).toBe('reseau')
    expect(blog.estHorsLigne).toBe(false)
    expect(blog.collections).toHaveLength(1)
    expect(blog.dernierArticle?.slug).toBe('recent')
    expect(blog.erreurReseau).toBeNull()
  })

  it('interroge chatbot-index.json à la racine du blog', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => indexReseau() })
    vi.stubGlobal('fetch', fetchMock)

    await useBlogStore().load()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://blog.eperformance.pro/chatbot-index.json',
      expect.anything(),
    )
  })

  it('replie sur la copie embarquée quand le réseau échoue (CORS, hors ligne)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))
    const blog = useBlogStore()

    await blog.load()

    expect(blog.source).toBe('embarque')
    expect(blog.estHorsLigne).toBe(true)
    expect(blog.erreurReseau).toBe('Failed to fetch')
    // Le repli est un vrai contenu : les collections restent exploitables
    expect(blog.collections.length).toBeGreaterThan(0)
    expect(blog.articles.length).toBeGreaterThan(0)
  })

  it('replie aussi sur une réponse HTTP en erreur', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    const blog = useBlogStore()

    await blog.load()

    expect(blog.source).toBe('embarque')
    expect(blog.erreurReseau).toBe('HTTP 404')
  })

  it('replie sur une charge valide en JSON mais pas au bon format', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ erreur: 'proxy' }) }),
    )
    const blog = useBlogStore()

    await blog.load()

    expect(blog.source).toBe('embarque')
    expect(blog.erreurReseau).toBe('Index invalide')
  })

  it('ne recharge pas un index déjà chargé (sauf force)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => indexReseau() })
    vi.stubGlobal('fetch', fetchMock)
    const blog = useBlogStore()

    await blog.load()
    await blog.load()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await blog.load(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('l’index embarqué ne contient que des articles publiés et datés', () => {
    expect(estIndexValide(INDEX_EMBARQUE)).toBe(true)
    for (const article of INDEX_EMBARQUE.articles) {
      expect(article.url).toMatch(/^https:\/\/blog\.eperformance\.pro\/articles\//)
      expect(Number.isNaN(new Date(article.date).getTime())).toBe(false)
    }
  })
})

describe('store blog — collections et recherche', () => {
  beforeEach(() => {
    const blog = useBlogStore()
    blog.index = indexReseau()
    blog.source = 'reseau'
  })

  it('compte les collections et liste leurs articles', () => {
    const blog = useBlogStore()

    expect(blog.nombreCollections).toBe(1)
    expect(blog.articlesDeCollection('acquisition')).toHaveLength(2)
    expect(blog.articlesDeCollection('inconnue')).toHaveLength(0)

    blog.ouvrirCollection('acquisition')
    expect(blog.collectionCourante?.titre).toBe('Acquisition')

    blog.reinitialiserAide()
    expect(blog.collectionCourante).toBeNull()
    expect(blog.recherche).toBe('')
  })

  it('filtre les résultats de recherche sur titre, description, tag et collection', () => {
    const blog = useBlogStore()
    blog.index = {
      ...indexReseau(),
      articles: [
        article({ slug: 'cac', titre: 'Calculer son CAC', tags: ['acquisition'] }),
        article({
          slug: 'seo',
          titre: 'SEO local',
          description: 'Apparaître sur Google',
          collection: 'seo',
          collection_titre: 'SEO',
        }),
      ],
    }

    blog.definirRecherche('google')
    expect(blog.resultatsRecherche.map((a) => a.slug)).toEqual(['seo'])

    blog.definirRecherche('  ')
    expect(blog.resultatsRecherche).toHaveLength(2)

    blog.definirRecherche('introuvable')
    expect(blog.resultatsRecherche).toHaveLength(0)
  })
})

describe('store blog — utilitaires exportés', () => {
  it('trie les articles du plus récent au plus ancien sans muter la source', () => {
    const source = [article({ slug: 'a', date: '2026-01-01T00:00:00Z' }), article({ slug: 'b', date: '2026-06-01T00:00:00Z' })]
    const trie = trierParDate(source)

    expect(trie.map((a) => a.slug)).toEqual(['b', 'a'])
    expect(source.map((a) => a.slug)).toEqual(['a', 'b'])
  })

  it('filtrerArticles retourne la liste complète sans terme', () => {
    const liste = [article({ slug: 'a' })]
    expect(filtrerArticles(liste, '')).toBe(liste)
  })

  it('estIndexValide refuse tout ce qui n’a pas articles + collections', () => {
    expect(estIndexValide(null)).toBe(false)
    expect(estIndexValide('texte')).toBe(false)
    expect(estIndexValide({ articles: [] })).toBe(false)
    expect(estIndexValide({ articles: [], collections: [] })).toBe(true)
  })
})
