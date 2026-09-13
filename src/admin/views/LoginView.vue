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
    // Le shell (App.vue) affiche le dashboard dès que isAuthenticated passe
    // à true ; on normalise aussi l'URL vers le dashboard.
    authRouter.replace({ name: 'dashboard' })
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
  background: radial-gradient(circle at 50% 20%, #16141c 0%, var(--ep-bg) 60%);
}

.ep-login__card {
  margin: auto;
  width: min(380px, 100%);
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 32px 28px;
  border-radius: var(--ep-radius-lg);
  border: 1px solid var(--ep-border);
  background: var(--ep-glass);
  backdrop-filter: blur(12px);
  box-shadow: var(--ep-shadow);
}

.ep-login__avatar {
  width: 64px;
  height: 64px;
  margin: 0 auto 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c9a96e 0%, #e2c07a 100%);
  color: #0a0a0e;
  display: grid;
  place-items: center;
  font-family: var(--ep-font-title);
  font-weight: 700;
  font-size: 28px;
  box-shadow: 0 0 0 6px rgba(201, 169, 110, 0.15);
}

.ep-login__title {
  margin: 0;
  text-align: center;
  font-family: var(--ep-font-title);
  font-size: 28px;
  font-weight: 600;
  color: var(--ep-gold-light);
}

.ep-login__subtitle {
  margin: 0 0 16px;
  text-align: center;
  font-size: 13px;
  color: var(--ep-text-muted);
}

.ep-login__label {
  margin-top: 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ep-text-muted);
}

.ep-login__input {
  padding: 12px 14px;
  border-radius: var(--ep-radius-md);
  border: 1px solid var(--ep-border);
  background: #060609;
  color: var(--ep-text);
  font-family: inherit;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.ep-login__input::placeholder {
  color: var(--ep-text-muted);
}

.ep-login__input:focus-visible {
  border-color: var(--ep-gold);
  box-shadow: 0 0 0 3px rgba(201, 169, 110, 0.15);
}

.ep-login__error {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: var(--ep-radius-md);
  background: rgba(220, 38, 38, 0.12);
  border: 1px solid rgba(220, 38, 38, 0.35);
  color: #fca5a5;
  font-size: 13px;
}

.ep-login__submit {
  margin-top: 18px;
  padding: 13px;
  border: none;
  border-radius: var(--ep-radius-full);
  background: linear-gradient(135deg, #c9a96e 0%, #e2c07a 100%);
  color: #0a0a0e;
  font-weight: 700;
  font-size: 15px;
  transition: transform 0.15s ease, opacity 0.2s ease;
}

.ep-login__submit:hover:not(:disabled) {
  transform: translateY(-1px);
}

.ep-login__submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
