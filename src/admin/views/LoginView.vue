<template>
  <div class="ep-login">
    <form class="ep-login__card" @submit.prevent="onSubmit">
      <div class="ep-login__avatar" aria-hidden="true">A</div>
      <h1 class="ep-login__title">ePerformance</h1>
      <p class="ep-login__subtitle">Console d’administration du chatbot</p>

      <label class="ep-login__label" for="ep-login-email">Email</label>
      <input
        id="ep-login-email"
        v-model.trim="email"
        class="ep-login__input"
        type="email"
        name="email"
        autocomplete="username"
        required
        placeholder="admin@eperformance.fr"
      />

      <label class="ep-login__label" for="ep-login-password">Mot de passe</label>
      <input
        id="ep-login-password"
        v-model="password"
        class="ep-login__input"
        type="password"
        name="password"
        autocomplete="current-password"
        required
        placeholder="••••••••"
      />

      <p v-if="error" class="ep-login__error" role="alert">{{ error }}</p>

      <button type="submit" class="ep-login__submit" :disabled="loading || !email || !password">
        {{ loading ? 'Connexion…' : 'Se connecter' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { ApiError } from '../api'
import { MODULE_PAR_DEFAUT } from '../navigation'
import { useAdminAuthStore } from '../stores/auth'

const auth = useAdminAuthStore()
const authRouter = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

async function onSubmit(): Promise<void> {
  if (!email.value || !password.value || loading.value) return
  loading.value = true
  error.value = null
  try {
    await auth.login(email.value, password.value)
    // Le shell (App.vue) affiche la console dès que isAuthenticated passe à
    // true ; on normalise aussi l'URL vers le module par défaut. Le nom est lu
    // dans le registre des modules — une constante écrite à la main ici avait
    // déjà divergé du nom réel de la route.
    void authRouter.replace({ name: MODULE_PAR_DEFAUT })
  } catch (e) {
    if (e instanceof ApiError && (e.status === 400 || e.status === 401)) {
      error.value = 'Email ou mot de passe incorrect.'
    } else if (e instanceof ApiError) {
      error.value = e.message
    } else {
      error.value = 'Impossible de joindre le serveur. Vérifiez votre connexion.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.ep-login {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 24px 16px;
  background: radial-gradient(1100px 620px at 82% -8%, var(--gold-bg), transparent 62%), radial-gradient(900px 520px at 4% 4%, var(--gold-bg), transparent 58%);
}

.ep-login__card {
  margin: auto;
  width: min(380px, 100%);
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 32px 28px;
  border-radius: var(--arrondi-carte);
  border: 1px solid var(--border);
  background: var(--card);
  box-shadow: var(--shadow-lg);
}

.ep-login__avatar {
  width: 64px;
  height: 64px;
  margin: 0 auto 8px;
  border-radius: 50%;
  background: var(--gold);
  color: var(--on-gold);
  display: grid;
  place-items: center;
  font-family: var(--police-titres);
  font-weight: 700;
  font-size: 28px;
  box-shadow: 0 0 0 6px var(--gold-bg);
}

.ep-login__title {
  margin: 0;
  text-align: center;
  font-family: var(--police-titres);
  font-size: 28px;
  font-weight: 600;
  color: var(--gold2);
}

.ep-login__subtitle {
  margin: 0 0 16px;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
}

.ep-login__label {
  margin-top: 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
}

.ep-login__input {
  padding: 12px 14px;
  border-radius: var(--arrondi-input);
  /* Un champ est un Contrôle (WCAG 1.4.11) : filet à 3:1, pas un filet décoratif */
  border: 1px solid var(--border-strong);
  background: var(--card);
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  outline: none;
  transition: border-color var(--t) var(--ease-out), box-shadow var(--t) var(--ease-out);
}

.ep-login__input::placeholder {
  color: var(--muted);
}

.ep-login__input:focus-visible {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px var(--gold-bg);
}

.ep-login__error {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: var(--arrondi-input);
  background: var(--red-bg);
  border: 1px solid var(--red-border);
  color: var(--red-text);
  font-size: 13px;
}

.ep-login__submit {
  margin-top: 18px;
  padding: 13px;
  border: none;
  border-radius: var(--arrondi-bouton);
  background: var(--gold);
  color: var(--on-gold);
  font-weight: 700;
  font-size: 15px;
  transition: background-color var(--t) var(--ease-out), transform var(--t-fast) var(--ease-out);
}

.ep-login__submit:hover:not(:disabled) {
  background: var(--gold2);
  transform: translateY(-1px);
}

.ep-login__submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
