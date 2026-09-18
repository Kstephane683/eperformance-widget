<template>
  <!--
    Intégrations — l'accès aux modules du CRM historique (PHP, sur LWS) et à
    quelques services rattachés. L'authentification y est INDÉPENDANTE (session
    PHP) : chaque lien s'ouvre dans un nouvel onglet, et la console le dit.
    Ces accès ne disparaîtront qu'avec la migration fonctionnelle complète
    (PLAN_FINAL_UNIFICATION_REEL.md).
  -->
  <div class="adm-page">
    <p class="adm-note">
      Modules du CRM PHP existant sur <strong>api.eperformance.pro</strong>. La session y est
      indépendante de la console : chaque lien s’ouvre dans un nouvel onglet.
    </p>

    <ul class="adm-grille">
      <li v-for="lien in LIENS" :key="lien.href">
        <a :href="lien.href" target="_blank" rel="noopener" class="adm-carte adm-carte--lien">
          <span class="adm-integration__vignette" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              focusable="false"
            >
              <path v-for="(trace, index) in lien.icone" :key="index" :d="trace" />
            </svg>
          </span>
          <span class="adm-integration__nom">{{ lien.nom }}</span>
          <span class="adm-integration__desc">{{ lien.description }}</span>
          <span class="adm-integration__chemin">{{ lien.chemin }}</span>
        </a>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
/**
 * Portail d'accès aux modules PHP LWS — jalon 1 de l'unification : on unifie
 * d'abord l'ACCÈS, la migration fonctionnelle PHP → FastAPI suit le calendrier
 * du plan. Un module migré est retiré d'ici, et seulement alors.
 *
 * Les icônes sont des tracés SVG décrits en clair (jamais de `v-html`).
 */
interface LienIntegration {
  nom: string
  description: string
  chemin: string
  href: string
  icone: readonly string[]
}

const LIENS: readonly LienIntegration[] = [
  {
    nom: 'Cockpit principal',
    description: 'Vue d’ensemble prospects, publications et alertes',
    chemin: '/cockpit.html',
    href: 'https://api.eperformance.pro/cockpit.html',
    icone: [
      'M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M5.9 5.9l2.1 2.1M16 16l2.1 2.1M18.1 5.9 16 8M8 16l-2.1 2.1',
      'M12 8.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4z',
    ],
  },
  {
    nom: 'Admin général',
    description: 'Administration complète du CRM',
    chemin: '/admin.php',
    href: 'https://api.eperformance.pro/admin.php',
    icone: [
      'M12 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
      'M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6',
    ],
  },
  {
    nom: 'Leads CRM',
    description: 'Prospects, candidats et suivi commercial',
    chemin: '/admin_leads.php',
    href: 'https://api.eperformance.pro/admin_leads.php',
    icone: [
      'M5 4h14v17H5z',
      'M9 3h6v3H9z',
      'M9 11h6M9 15h4',
    ],
  },
  {
    nom: 'Espace candidat',
    description: 'Candidatures aux accompagnements',
    chemin: '/espace-candidat.php',
    href: 'https://api.eperformance.pro/espace-candidat.php',
    icone: [
      'M12 3.5 2.5 8.2 12 13l9.5-4.8L12 3.5z',
      'M6.2 10.6V16c0 1.5 2.6 2.9 5.8 2.9s5.8-1.4 5.8-2.9v-5.4',
    ],
  },
  {
    nom: 'Proxy diagnostic',
    description: 'Relais des soumissions de diagnostic',
    chemin: '/proxy.php',
    href: 'https://api.eperformance.pro/proxy.php',
    icone: ['M9 3v6M15 3v6M6 9h12v3a6 6 0 0 1-12 0z', 'M12 18v3'],
  },
  {
    nom: 'Vue mobile',
    description: 'Interface mobile du CRM',
    chemin: '/mobile.php',
    href: 'https://api.eperformance.pro/mobile.php',
    icone: ['M6 2.5h12v19H6z', 'M10 18.5h4'],
  },
]
</script>

<style scoped>
.adm-integration__vignette {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: var(--arrondi-input);
  border: 1px solid var(--gold-border);
  background: var(--gold-bg);
  color: var(--gold);
}

.adm-integration__vignette svg {
  width: 20px;
  height: 20px;
}

.adm-integration__nom {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--gold2);
}

.adm-integration__desc {
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--muted);
}

.adm-integration__chemin {
  margin-top: auto;
  padding-top: 8px;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  font-size: 11.5px;
  color: var(--muted);
}
</style>
