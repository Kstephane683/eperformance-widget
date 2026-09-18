<template>
  <!-- Ouvre l'article sur le blog, dans un nouvel onglet (contrat : le widget
       ne navigue jamais la page hôte). -->
  <a class="ep-article" :href="article.url" target="_blank" rel="noopener">
    <!-- Aperçu : image de l'article si le blog en publie une, sinon la
         vignette SVG de la collection (langage des cartes du blog). -->
    <span class="ep-article__apercu" aria-hidden="true">
      <img v-if="article.image" :src="article.image" alt="" loading="lazy" />
      <svg v-else viewBox="0 0 24 24" fill="none">
        <path
          v-for="(trace, i) in vignette.traces"
          :key="i"
          :d="trace"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>

    <span class="ep-article__corps">
      <span class="ep-article__categorie">{{ article.collection_titre || 'Article' }}</span>
      <span class="ep-article__titre">{{ article.titre }}</span>
      <span class="ep-article__texte">{{ article.description }}</span>

      <span v-if="article.tags?.length" class="ep-tags">
        <span v-for="tag in article.tags" :key="tag" class="ep-tag">{{ tag }}</span>
      </span>

      <span class="ep-article__pied">
        <span>{{ date }}</span>
        <span aria-hidden="true">·</span>
        <span>Lecture sur le blog</span>
        <svg
          class="ep-article__fleche"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 12h13M13 6.5 18.5 12 13 17.5"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </span>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { vignetteCollection } from '@/helpers/iconesCollections'
import { dateCourte } from '@/helpers/relativeTime'
import type { BlogArticle } from '@/types/blog'

const props = defineProps<{ article: BlogArticle }>()

const vignette = computed(() => vignetteCollection(props.article.collection))
const date = computed(() => dateCourte(props.article.date))
</script>
