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
/* Trame de fond canonique (eperf.css:321-323) : deux halos d'accent sous 7 %,
   à la place du dégradé radial sombre en dur. */
.ep-home {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background:
    radial-gradient(1100px 620px at 82% -8%, var(--gold-bg), transparent 62%),
    radial-gradient(900px 520px at 4% 4%, var(--gold-bg), transparent 58%);
  text-align: center;
  padding: 24px;
}

/* Avatar : aplat d'accent + --on-gold. Le dégradé à deux arrêts est proscrit
   (ADR-0003:57) ; le halo reprend --gold-bg comme la bulle du SDK. */
.ep-home__avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--gold);
  color: var(--on-gold);
  display: grid;
  place-items: center;
  font-family: var(--police-titres);
  font-weight: 700;
  font-size: 34px;
  margin-bottom: 8px;
  box-shadow: 0 0 0 6px var(--gold-bg);
}

/* Titre : doctrine du site (eperf.css:341-347) — serif, 600, interligne 1.08,
   interlettre -0.02em */
.ep-home__title {
  font-family: var(--police-titres);
  font-size: 30px;
  font-weight: 600;
  line-height: 1.08;
  letter-spacing: -0.02em;
  color: var(--gold2);
}

.ep-home__subtitle {
  margin-bottom: 16px;
  color: var(--muted);
  font-size: 14px;
}

/* Bouton principal : recette .btn + .btn-gold (eperf.css:489-516) */
.ep-home__cta {
  padding: 12px 32px;
  border: none;
  border-radius: var(--arrondi-bouton);
  background: var(--gold);
  color: var(--on-gold);
  box-shadow: var(--shadow-gold);
  font-weight: 600;
  font-size: 15px;
  transition: background-color var(--t) var(--ease-out),
              transform var(--t-fast) var(--ease-out);
}

.ep-home__cta:hover {
  background: var(--gold2);
}

.ep-home__cta:active {
  transform: translateY(1px);
}
</style>
