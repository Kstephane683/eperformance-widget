<template>
  <section class="crm">
    <header class="crm__head">
      <h1 class="crm__title">CRM LWS</h1>
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
        <span class="crm__icon" aria-hidden="true" v-html="link.icon"></span>
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
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    name: 'Cockpit principal',
    desc: 'Vue d\'ensemble prospects, publications et alertes',
    path: '/cockpit.html',
    href: 'https://api.eperformance.pro/cockpit.html',
  },
  {
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    name: 'Admin général',
    desc: 'Administration complète du CRM',
    path: '/admin.php',
    href: 'https://api.eperformance.pro/admin.php',
  },
  {
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M9 3h6v3H9zM9 11h6M9 15h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    name: 'Leads CRM',
    desc: 'Prospects, candidats et suivi commercial',
    path: '/admin_leads.php',
    href: 'https://api.eperformance.pro/admin_leads.php',
  },
  {
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3L2 8l10 5 10-5-10-5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5" stroke="currentColor" stroke-width="1.8"/></svg>`,
    name: 'Espace candidat',
    desc: 'Candidatures aux accompagnements',
    path: '/espace-candidat.php',
    href: 'https://api.eperformance.pro/espace-candidat.php',
  },
  {
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 3v6M15 3v6M6 9h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6V9zM12 18v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    name: 'Proxy diagnostic',
    desc: 'Relais des soumissions de diagnostic',
    path: '/proxy.php',
    href: 'https://api.eperformance.pro/proxy.php',
  },
  {
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="6" y="2" width="12" height="20" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M10 18h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
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
  font-family: var(--police-titres);
  font-size: 22px;
  color: var(--gold2);
}

.crm__note {
  margin: 0;
  color: var(--muted);
  font-size: 13.5px;
  max-width: 640px;
  line-height: 1.6;
}

.crm__note strong {
  color: var(--text);
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
  border: 1px solid var(--border);
  border-radius: var(--arrondi-input);
  background: var(--bg2);
  text-decoration: none;
  color: var(--text);
  transition: border-color 0.2s ease, transform 0.15s ease;
}

.crm__card:hover {
  border-color: var(--gold);
  transform: translateY(-2px);
}

.crm__icon {
  font-size: 26px;
}

.crm__name {
  font-weight: 600;
  font-size: 15px;
  color: var(--gold2);
}

.crm__desc {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
}

.crm__path {
  font-size: 11.5px;
  color: var(--muted);
  opacity: 0.7;
  font-family: monospace;
}
</style>
