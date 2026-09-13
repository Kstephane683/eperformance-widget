<template>
  <!--
    Shell admin : bascule Login / Dashboard pilotée par le store auth
    (réactive, y compris sur 401 → logout automatique). Le routeur hash
    (cf. main.ts) gère le deep-linking et la protection des routes ;
    quand on n'est PAS authentifié, on rend LoginView directement pour
    que l'écran de connexion s'affiche où que pointe l'URL.
  -->
  <LoginView v-if="!auth.isAuthenticated" />
  <router-view v-else />
</template>

<script setup lang="ts">
import { useAdminAuthStore } from './stores/auth'
import LoginView from './views/LoginView.vue'

const auth = useAdminAuthStore()
</script>

<style>
/* Montage dédié #admin (admin.html) — même gabarit plein écran que #app.
   body est position:fixed (style.css, héritage widget) : le layout admin
   occupe 100% du viewport et chaque volet scrolle en interne. */
#admin {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
