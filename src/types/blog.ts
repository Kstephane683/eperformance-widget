/**
 * Types de `chatbot-index.json` — index public du blog.
 *
 * Source de vérité : /home/ballo/OX6A/blog-eperformance/_build/generer_index_chatbot.py
 * (publié à la racine du blog, copie embarquée dans src/data/).
 * L'index ne contient QUE des articles publiés (drapeau `_schedule.json`
 * `published: true` ET page sans `noindex`) : aucune avant-première ne fuit.
 */

export interface BlogCollection {
  slug: string
  titre: string
  /** Slogan de la page de tête du blog (null si la section n'en a pas) */
  slogan?: string | null
  /** Page de tête de collection — null pour une section sans page dédiée */
  url: string | null
  nombre: number
}

export interface BlogArticle {
  slug: string
  titre: string
  description: string
  /** Slug de la collection de rattachement (ex. « ia-generative ») */
  collection: string | null
  collection_titre: string | null
  /** Date de publication affichée par le blog (JSON-LD datePublished) */
  date: string
  url: string
  tags: string[]
  /** Aperçu dédié à l'article (null : le blog n'a pas d'image par article) */
  image: string | null
}

export interface BlogIndex {
  genere_le: string
  source: string
  collections: BlogCollection[]
  articles: BlogArticle[]
}

/** D'où vient l'index actuellement affiché */
export type BlogIndexSource = 'reseau' | 'embarque'
