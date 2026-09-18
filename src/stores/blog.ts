/**
 * Store blog — index public du blog (onglets Aide et Actualités).
 *
 * Charge `chatbot-index.json` :
 *   1. par le réseau (`{blogIndexUrl}/chatbot-index.json`) ;
 *   2. à défaut (hors-ligne, CORS, 404, charge invalide) → copie embarquée
 *      dans le bundle (`src/data/chatbot-index.json`, générée par
 *      blog-eperformance/_build/generer_index_chatbot.py).
 *
 * Le repli est un vrai repli, pas un écran vide : l'utilisateur voit toujours
 * les articles publiés, et l'interface indique la source (« version hors ligne »).
 *
 * L'index ne contient que des articles publiés : aucune avant-première ne fuit
 * (drapeau `_schedule.json` + `noindex` côté blog, cf. script générateur).
 */

import { defineStore } from 'pinia'

import indexEmbarque from '@/data/chatbot-index.json'
import type { BlogArticle, BlogCollection, BlogIndex, BlogIndexSource } from '@/types/blog'
import { useConfigStore } from '@/stores/config'

const TIMEOUT_MS = 6_000

/** Extrait brut du bundle — sert de repli et de jeu de données de démo */
export const INDEX_EMBARQUE = indexEmbarque as unknown as BlogIndex

/**
 * Validation minimale de la charge réseau : un JSON valide mais d'une autre
 * forme (page d'erreur d'un proxy, index d'un autre site) ne doit pas casser
 * l'interface — on préfère le repli embarqué.
 */
export function estIndexValide(valeur: unknown): valeur is BlogIndex {
  if (!valeur || typeof valeur !== 'object') return false
  const index = valeur as Partial<BlogIndex>
  return Array.isArray(index.articles) && Array.isArray(index.collections)
}

/** Trie « les plus récentes d'abord » sans muter la source */
export function trierParDate(articles: BlogArticle[]): BlogArticle[] {
  return [...articles].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

/** Recherche plein texte simple (titre, description, tags, collection) */
export function filtrerArticles(articles: BlogArticle[], requete: string): BlogArticle[] {
  const terme = requete.trim().toLowerCase()
  if (!terme) return articles
  return articles.filter((article) =>
    [article.titre, article.description, article.collection_titre ?? '', ...(article.tags ?? [])]
      .join(' ')
      .toLowerCase()
      .includes(terme),
  )
}

export const useBlogStore = defineStore('blog', {
  state: () => ({
    index: null as BlogIndex | null,
    /** Source de l'index affiché (null tant que rien n'est chargé) */
    source: null as BlogIndexSource | null,
    isLoading: false,
    /** Renseigné si le réseau a échoué (le repli embarqué est alors utilisé) */
    erreurReseau: null as string | null,
    /* ---- État de l'onglet Aide ---- */
    /** Collection ouverte dans la liste d'articles (null = liste des collections) */
    collectionOuverte: null as string | null,
    recherche: '',
  }),

  getters: {
    collections: (state): BlogCollection[] => state.index?.collections ?? [],

    articles: (state): BlogArticle[] => trierParDate(state.index?.articles ?? []),

    /** Article vedette de l'accueil : le dernier publié */
    dernierArticle(): BlogArticle | null {
      return this.articles[0] ?? null
    },

    /** Nombre de collections — « N collections » de l'onglet Aide */
    nombreCollections(): number {
      return this.collections.length
    },

    collectionCourante: (state): BlogCollection | null =>
      state.index?.collections.find((entree) => entree.slug === state.collectionOuverte) ?? null,

    articlesDeCollection(): (slug: string) => BlogArticle[] {
      return (slug: string) => this.articles.filter((a) => a.collection === slug)
    },

    /** Résultats de recherche (vide → tous les articles) */
    resultatsRecherche(state): BlogArticle[] {
      return filtrerArticles(this.articles, state.recherche)
    },

    /** Les Actualités affichent les articles, filtrés par la recherche d'Aide */
    estHorsLigne: (state) => state.source === 'embarque',
  },

  actions: {
    /** Charge l'index : réseau d'abord, repli embarqué ensuite (jamais d'échec) */
    async load(force = false): Promise<BlogIndex> {
      if (this.index && !force) return this.index

      this.isLoading = true
      this.erreurReseau = null
      const config = useConfigStore()
      const base = config.config.blogIndexUrl.replace(/\/+$/, '')

      try {
        const reponse = await fetch(`${base}/chatbot-index.json`, {
          signal: AbortSignal.timeout?.(TIMEOUT_MS),
        })
        if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`)
        const charge: unknown = await reponse.json()
        if (!estIndexValide(charge)) throw new Error('Index invalide')
        this.index = charge
        this.source = 'reseau'
      } catch (erreur) {
        // Repli embarqué : l'interface reste fonctionnelle hors ligne (CORS, 404)
        this.erreurReseau = erreur instanceof Error ? erreur.message : 'Erreur réseau'
        this.index = INDEX_EMBARQUE
        this.source = 'embarque'
      } finally {
        this.isLoading = false
      }
      return this.index
    },

    ouvrirCollection(slug: string | null) {
      this.collectionOuverte = slug
    },

    definirRecherche(requete: string) {
      this.recherche = requete
    },

    /** Réinitialise l'onglet Aide (retour à la liste des collections) */
    reinitialiserAide() {
      this.collectionOuverte = null
      this.recherche = ''
    },
  },
})
