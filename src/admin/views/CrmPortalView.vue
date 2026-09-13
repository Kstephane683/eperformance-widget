<template>
  <section class="crm">
    <header class="crm__head">
      <h1 class="crm__title">🧭 CRM LWS</h1>
      <p class="crm__note">
        Modules du CRM PHP existant sur <strong>api.eperformance.pro</strong> (LWS).
        L'authentification est indépendante (session PHP) — chaque lien s'ouvre dans un
        nouvel onglet.
      </p>
    </header>

    <div class="crm__grid">
      <a
        v-for="link in LINKS"
        :key="link.href"
        :href="link.href"
        target="_blank"
        rel="noopener"
        class="crm__card"
      >
        <span class="crm__icon" aria-hidden="true">{{ link.icon }}</span>
        <span class="crm__name">{{ link.name }}</span>
        <span class="crm__desc">{{ link.desc }}</span>
        <span class="crm__path" aria-hidden="true">{{ link.path }}</span>
      </a>
    </div>
  </section>
</template>

<script setup lang="ts">
// Portail d'accès aux modules PHP LWS (jalon 1 de l'unification :
// unification d'ACCÈS — la migration fonctionnelle PHP→FastAPI suit le
// calendrier du PLAN_FINAL_UNIFICATION_REEL.md).
const LINKS = [
  {
    icon: '🎛️',
    name: 'Cockpit principal',
    desc: 'Vue d\'ensemble prospects, publications et alertes',
    path: '/cockpit.html',
    href: 'https://api.eperformance.pro/cockpit.html',
  },
  {
    icon: '👤',
    name: 'Admin général',
    desc: 'Administration complète du CRM',
    path: '/admin.php',
    href: 'https://api.eperformance.pro/admin.php',
  },
  {
    icon: '📋',
    name: 'Leads CRM',
    desc: 'Prospects, candidats et suivi commercial',
    path: '/admin_leads.php',
    href: 'https://api.eperformance.pro/admin_leads.php',
  },
  {
    icon: '🎓',
    name: 'Espace candidat',
    desc: 'Candidatures aux accompagnements',
    path: '/espace-candidat.php',
    href: 'https://api.eperformance.pro/espace-candidat.php',
  },
  {
    icon: '🔌',
    name: 'Proxy diagnostic',
    desc: 'Relais des soumissions de diagnostic',
    path: '/proxy.php',
    href: 'https://api.eperformance.pro/proxy.php',
  },
  {
    icon: '📱',
    name: 'Vue mobile',
    desc: 'Interface mobile du CRM',
    path: '/mobile.php',
    href: 'https://api.eperformance.pro/mobile.php',
  },
]
</script>

<style scoped>
.crm {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.crm__head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.crm__title {
  margin: 0;
  font-family: var(--ep-font-title);
  font-size: 22px;
  color: var(--ep-gold-light);
}

.crm__note {
  margin: 0;
  color: var(--ep-text-muted);
  font-size: 13.5px;
  max-width: 640px;
  line-height: 1.6;
}

.crm__note strong {
  color: var(--ep-text);
}

.crm__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}

.crm__card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  border: 1px solid var(--ep-border-soft);
  border-radius: var(--ep-radius-md);
  background: var(--ep-surface);
  text-decoration: none;
  color: var(--ep-text);
  transition: border-color 0.2s ease, transform 0.15s ease;
}

.crm__card:hover {
  border-color: var(--ep-gold);
  transform: translateY(-2px);
}

.crm__icon {
  font-size: 26px;
}

.crm__name {
  font-weight: 600;
  font-size: 15px;
  color: var(--ep-gold-light);
}

.crm__desc {
  font-size: 13px;
  color: var(--ep-text-muted);
  line-height: 1.5;
}

.crm__path {
  font-size: 11.5px;
  color: var(--ep-text-muted);
  opacity: 0.7;
  font-family: monospace;
}
</style>
