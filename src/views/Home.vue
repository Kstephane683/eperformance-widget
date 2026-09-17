<template>
  <div class="ep-home">
    <div class="ep-home__avatar" aria-hidden="true">A</div>
    <h1 class="ep-home__title">Mia</h1>
    <p class="ep-home__subtitle">Agent IA ePerformance</p>
    <button type="button" class="ep-home__cta" @click="start">
      Démarrer la conversation
    </button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function start() {
  router.push({ name: 'messages' })
}
</script>

<style scoped>
.ep-home {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: radial-gradient(circle at 50% 30%, #16141c 0%, var(--ep-bg) 60%);
  text-align: center;
  padding: 24px;
}

.ep-home__avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c9a96e 0%, #e2c07a 100%);
  color: #0a0a0e;
  display: grid;
  place-items: center;
  font-family: var(--ep-font-title);
  font-weight: 700;
  font-size: 34px;
  margin-bottom: 8px;
  box-shadow: 0 0 0 6px rgba(201, 169, 110, 0.15);
}

.ep-home__title {
  margin: 0;
  font-family: var(--ep-font-title);
  font-size: 30px;
  color: var(--ep-gold-light);
}

.ep-home__subtitle {
  margin: 0 0 18px;
  color: var(--ep-text-muted);
  font-size: 14px;
}

.ep-home__cta {
  padding: 13px 32px;
  border: none;
  border-radius: var(--ep-radius-full);
  background: linear-gradient(135deg, #c9a96e 0%, #e2c07a 100%);
  color: #0a0a0e;
  font-weight: 700;
  font-size: 15px;
  transition: transform 0.15s ease;
}

.ep-home__cta:hover {
  transform: translateY(-2px);
}
</style>
