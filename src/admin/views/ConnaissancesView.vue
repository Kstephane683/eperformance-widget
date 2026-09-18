<template>
  <!--
    Base de connaissances — les collections éditoriales que Mia peut citer.
    La source est l'index public du blog, embarqué dans le bundle : l'écran
    fonctionne donc sans réseau, et l'index ne contient QUE des articles
    publiés (aucune avant-première ne peut fuir par cette page).
  -->
  <div class="adm-page">
    <p class="adm-note">
      Index généré le <strong>{{ dateGenere }}</strong> depuis
      <a :href="index.source" target="_blank" rel="noopener">{{ index.source }}</a>.
      {{ index.collections.length }} collection(s), {{ index.articles.length }} article(s)
      publié(s) — c’est le corpus dans lequel Mia puise ses réponses.
    </p>

    <div class="adm-grille">
      <article v-for="collection in index.collections" :key="collection.slug" class="adm-carte">
        <span class="adm-eyebrow">{{ collection.nombre }} article(s)</span>
        <h2 class="adm-titre">{{ collection.titre }}</h2>
        <p v-if="collection.slogan" class="adm-page__note">{{ collection.slogan }}</p>
        <p v-else class="adm-note">Collection sans page de tête dédiée.</p>

        <ul class="adm-liens">
          <li v-if="collection.url">
            <a :href="collection.url" target="_blank" rel="noopener" class="adm-btn adm-btn--discret">
              Ouvrir sur le blog
            </a>
          </li>
          <li>
            <RouterLink
              :to="{ name: 'publications', query: { collection: collection.slug } }"
              class="adm-btn adm-btn--discret"
            >
              Voir les articles
            </RouterLink>
          </li>
        </ul>
      </article>
    </div>

    <div class="adm-filet"><span class="adm-eyebrow">Articles par collection</span></div>

    <div class="adm-tableau-cadre">
      <table class="adm-tableau">
        <caption class="adm-visuellement-cache">
          Nombre d’articles publiés par collection
        </caption>
        <thead>
          <tr>
            <th scope="col">Collection</th>
            <th scope="col">Identifiant</th>
            <th scope="col">Articles</th>
            <th scope="col">Page de tête</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="collection in index.collections" :key="collection.slug">
            <td class="adm-tableau__fort">{{ collection.titre }}</td>
            <td>{{ collection.slug }}</td>
            <td>{{ collection.nombre }}</td>
            <td>
              <a v-if="collection.url" :href="collection.url" target="_blank" rel="noopener">
                {{ collection.url.replace('https://', '') }}
              </a>
              <span v-else class="adm-note">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { INDEX_EMBARQUE } from '@/stores/blog'
import { dateCourteOuTiret } from '../format'

const index = INDEX_EMBARQUE
const dateGenere = computed(() => dateCourteOuTiret(index.genere_le))
</script>

<style scoped>
.adm-liens {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}
</style>
