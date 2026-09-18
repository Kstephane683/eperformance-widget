<template>
  <!--
    Publications — les articles que Mia peut proposer à un visiteur.
    Même source que la base de connaissances (index public embarqué) : un seul
    corpus, une seule vérité. Le filtre par collection arrive par l'URL, ce qui
    permet d'y atterrir depuis la base de connaissances.
  -->
  <div class="adm-page">
    <div class="adm-outils">
      <div class="adm-recherche adm-publications__recherche">
        <svg
          class="adm-publications__loupe"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
        <input
          v-model.trim="recherche"
          type="search"
          placeholder="Rechercher un article, un mot-clé…"
          aria-label="Rechercher un article publié"
        />
      </div>

      <select v-model="collection" class="adm-champ" aria-label="Filtrer par collection">
        <option value="">Toutes les collections</option>
        <option v-for="entree in index.collections" :key="entree.slug" :value="entree.slug">
          {{ entree.titre }}
        </option>
      </select>

      <div class="adm-outils__fin">
        <span class="adm-note">{{ filtered.length }} article(s)</span>
      </div>
    </div>

    <p v-if="filtered.length === 0" class="adm-vide__texte">
      Aucun article publié ne correspond à ce filtre.
    </p>

    <ul v-else class="adm-liste">
      <li v-for="article in filtered" :key="article.slug">
        <a :href="article.url" target="_blank" rel="noopener" class="adm-ligne adm-article">
          <span class="adm-ligne__corps">
            <span class="adm-article__meta">
              <span class="adm-article__collection">{{ article.collection_titre ?? 'Sans collection' }}</span>
              <span class="adm-ligne__meta">{{ dateCourteOuTiret(article.date) }}</span>
            </span>
            <span class="adm-article__titre">{{ article.titre }}</span>
            <span class="adm-article__description">{{ tronquer(article.description, 180) }}</span>
            <span v-if="article.tags && article.tags.length > 0" class="adm-article__tags">
              <span v-for="tag in article.tags" :key="tag" class="adm-article__tag">{{ tag }}</span>
            </span>
          </span>
          <svg
            class="adm-article__marque"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M14 4h6v6" />
            <path d="M20 4 11 13" />
            <path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7.5A1.5 1.5 0 0 1 5 6h4.5" />
          </svg>
        </a>
      </li>
    </ul>

    <p class="adm-note">
      Index embarqué généré le <strong>{{ dateCourteOuTiret(index.genere_le) }}</strong> —
      {{ index.articles.length }} article(s) publié(s). Les liens ouvrent le blog dans un
      nouvel onglet.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { INDEX_EMBARQUE, filtrerArticles } from '@/stores/blog'
import { dateCourteOuTiret, tronquer } from '../format'

const route = useRoute()
const index = INDEX_EMBARQUE

const recherche = ref('')
const collection = ref('')

watch(
  () => route.query,
  (query) => {
    const q = query.q
    if (typeof q === 'string' && q.length > 0) recherche.value = q
    const slug = query.collection
    if (typeof slug === 'string' && slug.length > 0) collection.value = slug
  },
  { immediate: true },
)

const filtered = computed(() => {
  const parTexte = filtrerArticles(index.articles, recherche.value)
  const liste = collection.value
    ? parTexte.filter((article) => article.collection === collection.value)
    : parTexte
  return [...liste].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
})
</script>

<style scoped>
.adm-publications__recherche {
  flex: 1;
  min-width: 180px;
  max-width: 420px;
}

.adm-publications__loupe {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.adm-article {
  align-items: flex-start;
}

.adm-article__meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.adm-article__collection {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--gold);
}

.adm-article__titre {
  margin-top: 2px;
  font-family: var(--police-titres);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--text);
}

.adm-article__description {
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--muted);
}

.adm-article__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.adm-article__tag {
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: var(--arrondi-bouton);
  background: var(--card2);
  color: var(--muted);
  font-size: 10.5px;
}

.adm-article__marque {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--gold);
}
</style>
