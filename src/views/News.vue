<template>
  <div class="ep-vue">
    <header class="ep-actualites__entete">
      <h1 class="ep-vue__titre">Actualités</h1>
      <p class="ep-vue__sous-titre">Les plus récentes</p>
    </header>

    <div class="ep-filet" aria-hidden="true" />
    <span class="ep-eyebrow">De l’équipe ePerformance</span>

    <p v-if="blog.isLoading" class="ep-etat">Chargement des articles…</p>

    <ul v-else class="ep-liste">
      <li v-for="article in blog.articles" :key="article.slug">
        <ArticleCard :article="article" />
      </li>
    </ul>

    <p v-if="!blog.isLoading && !blog.articles.length" class="ep-etat">
      Aucun article publié pour le moment.
    </p>

    <p v-if="blog.estHorsLigne" class="ep-etat">
      Version hors ligne : les articles sont servis depuis la copie embarquée du widget.
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * Onglet Actualités — les articles du blog, les plus récents d'abord.
 *
 * Même source que l'onglet Aide (chatbot-index.json) : une seule vérité,
 * deux présentations (Intercom fait de même entre « Aide » et « Actualités »).
 */
import { onMounted } from 'vue'

import ArticleCard from '@/components/ArticleCard.vue'
import { useBlogStore } from '@/stores/blog'

const blog = useBlogStore()

onMounted(() => {
  void blog.load()
})
</script>

<style scoped>
.ep-actualites__entete {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ep-filet {
  margin: -4px 0;
}
</style>
