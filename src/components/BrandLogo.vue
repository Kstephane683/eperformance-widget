<template>
  <!--
    Logo ePerformance en SVG.
    Le site ne publie son logo qu'en WebP (assets/img/logo-light.webp et
    logo-dark.webp, hauteur 30 px) : il n'existe aucun SVG dans le dépôt du
    site. Cette version est la reprise VECTORIELLE de ce fichier — la marque
    (cercle fin + cinq points reliés) et le mot-symbole « e » or suivi de
    « Performance » — dessinée avec les jetons canoniques, donc elle suit le
    thème clair/sombre comme le reste du widget (le WebP, lui, est figé).
    Aucun fichier image, aucun poids de bundle.
  -->
  <svg
    class="ep-logo"
    viewBox="0 0 196 30"
    role="img"
    aria-label="ePerformance"
    focusable="false"
  >
    <g class="ep-logo__mark">
      <circle cx="15" cy="15" r="13.4" fill="none" stroke="var(--gold-border)" stroke-width="1" />
      <path
        d="M15 15 6.2 9.6M15 15V3.4M15 15l8.8-5.4M15 15v11.6"
        stroke="var(--gold-border)"
        stroke-width="1"
        stroke-linecap="round"
      />
      <circle cx="6.2" cy="9.6" r="2.1" fill="var(--gold)" />
      <circle cx="15" cy="3.4" r="2.1" fill="var(--gold)" />
      <circle cx="23.8" cy="9.6" r="2.1" fill="var(--gold)" />
      <circle cx="15" cy="26.6" r="2.1" fill="var(--gold)" />
      <circle cx="15" cy="15" r="4.1" fill="var(--gold)" />
    </g>
    <text class="ep-logo__word" x="36" y="21.5">
      <tspan fill="var(--gold)">e</tspan><tspan fill="var(--text)">Performance</tspan>
    </text>
  </svg>
</template>

<style scoped>
.ep-logo {
  height: 26px;
  width: auto;
  display: block;
  flex-shrink: 0;
}

/* Mot-symbole : graisse 700 de la police de corps (le logo du site est un
   sans-serif gras), interlettre serrée comme le fichier d'origine. */
.ep-logo__word {
  font-family: var(--police-corps);
  font-size: 20.5px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
</style>
