var ePerformanceSDK=(function(e){Object.defineProperty(e,Symbol.toStringTag,{value:`Module`});var t={widgetUrl:`http://localhost:4173`,apiUrl:`https://web-production-4ab53.up.railway.app`,siteId:`eperformance_vitrine`,position:`right`,blogIndexUrl:`https://blog.eperformance.pro`},n={light:`#856b37`,dark:`#c9a96e`},r={light:`#735d32`,dark:`#e2c07a`},i={light:`#ffffff`,dark:`#0a0a0e`},ee={light:`#faf8f4`,dark:`#14141a`},a={light:`#16151a`,dark:`#edeae3`},o=`eperformance-widget:`,te=2147483e3,s=`.consent`,c=`ep-consent-visible`,l=119,u=`.sticky-cta`,d=`--ep-sdk-cta-offset`,f=`eperformance-widget-frame`,p=`eperformance-widget-holder`,m=`eperformance-widget-bubble`,h=`eperformance-widget-teaser`,g=`eperf_widget_open`,_=`eperf_teaser_done`,v=668,y=2e4,b=`cubic-bezier(0.16, 1, 0.3, 1)`,x=`
#${p} {
  position: fixed !important;
  /* Le décalage bas suit la hauteur réelle de .sticky-cta quand elle est
     affichée (0 px sinon) : le panneau ne recouvre jamais la barre CTA. */
  bottom: calc(88px + var(${d}, 0px));
  width: 400px;
  max-width: calc(100vw - 40px);
  height: min(650px, calc(100dvh - 110px));
  z-index: ${te} !important;
  opacity: 0;
  visibility: hidden;
  transform: translateY(24px) scale(0.98);
  transition: opacity var(--t, 300ms) var(--ease-out, ${b}),
              transform var(--t, 300ms) var(--ease-out, ${b}),
              visibility var(--t, 300ms);
  pointer-events: none;
}
/* Le bandeau de consentement du site (z-index: 120) passe devant le widget :
   tant qu'il est affiché, le holder redescend sous 120 (DÉCISION D9). */
#${p}.${c} { z-index: ${l} !important; }
#${p}.ep-holder--right { right: 20px; }
#${p}.ep-holder--left { left: 20px; }
#${p}.ep-holder--visible {
  opacity: 1;
  visibility: visible;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}
#${f} {
  width: 100%;
  height: 100%;
  border: 0;
  /* --arrondi-bloc vaut 12px dans eperf.css:148 (bloc, et non 20px comme le
     laissait croire le tableau §5.5 du document d'audit). */
  border-radius: var(--arrondi-bloc, 12px);
  box-shadow: var(--shadow-lg, 0 12px 32px rgba(22, 21, 26, 0.08), 0 32px 64px rgba(22, 21, 26, 0.09));
}
#${m} {
  position: fixed !important;
  /* Chat fermé : la bulle se pose AU-DESSUS de la barre CTA mobile
     (hauteur mesurée) — le bouton WhatsApp de la barre reste cliquable. */
  bottom: calc(20px + var(${d}, 0px));
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  z-index: 2147483001 !important;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 2e ombre : le halo d'accent, comme le bouton WhatsApp du site */
  box-shadow: var(--shadow-lg, 0 12px 32px rgba(22, 21, 26, 0.08), 0 32px 64px rgba(22, 21, 26, 0.09)),
              0 0 0 6px var(--gold-bg, rgba(133, 107, 55, 0.07));
  background: var(--gold, var(--ep-sdk-gold));
  color: var(--on-gold, var(--ep-sdk-on-gold));
  transition: background-color var(--t, 300ms) var(--ease-out, ${b}),
              transform var(--t-fast, 150ms) var(--ease-out, ${b});
}
#${m}:hover { background: var(--gold2, var(--ep-sdk-gold-hover)); }
#${m}:active { transform: translateY(1px); }
#${m}.ep-bubble--right { right: 20px; }
#${m}.ep-bubble--left { left: 20px; }
/* Consentement affiché : la bulle (et la bulle d'accroche) s'effacent, comme
   le bouton WhatsApp du site — eperf.css:1179. */
#${m}.${c},
#${h}.${c} { display: none !important; }
@media (max-width: ${v}px) {
  #${p} {
    right: 0 !important;
    left: 0 !important;
    top: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    /* 100% (viewport exact) plutôt que 100dvh: dvh inclut les barres
       rétractables du navigateur → débordement haut (header coupé) */
    height: 100% !important;
    max-width: 100%;
    border-radius: 0;
  }
  #${f} { border-radius: 0; }
  #${m}.ep-bubble--right, #${m}.ep-bubble--left { right: 16px; }
  /* Widget ouvert en plein écran : la bubble-croix masquerait l'input —
     le bouton fermer est dans le header du widget */
  #${m}.ep-bubble--open { display: none !important; }
  #${h} { right: 16px; bottom: calc(88px + var(${d}, 0px)); }
}

/* Accessibilité : réduire les animations si demandé par le système */
@media (prefers-reduced-motion: reduce) {
  #${p}, #${m}, #${h} {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Teaser proactif (pattern Intercom/Drift — héritage v6.0) */
#${h} {
  position: fixed !important;
  /* Même décalage que la bulle : l'accroche ne recouvre pas la barre CTA */
  bottom: calc(88px + var(${d}, 0px));
  right: 20px;
  z-index: 2147483002 !important;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 280px;
  padding: 12px 16px;
  /* 4px : queue de bulle, seule valeur hors échelle admise (DESIGN-SYSTEM-UNIFIE §5.5) */
  border-radius: var(--arrondi-bloc, 12px) var(--arrondi-bloc, 12px) 4px var(--arrondi-bloc, 12px);
  background: var(--card2, var(--ep-sdk-card2));
  color: var(--text, var(--ep-sdk-text));
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.45;
  box-shadow: var(--shadow-md, 0 4px 12px rgba(22, 21, 26, 0.06), 0 12px 28px rgba(22, 21, 26, 0.07)),
              0 0 0 1px var(--gold-border, rgba(133, 107, 55, 0.22));
  cursor: pointer;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity var(--t, 300ms) var(--ease-out, ${b}),
              transform var(--t, 300ms) var(--ease-out, ${b});
}
#${h}.ep-teaser--visible {
  opacity: 1;
  transform: translateY(0);
}
#${h} button {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: var(--gold-bg, rgba(133, 107, 55, 0.07));
  color: var(--gold, var(--ep-sdk-gold));
  font-size: 11px;
  cursor: pointer;
}
`,S=`<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3C6.9 3 2.8 6.6 2.8 11c0 2.1 0.9 4 2.4 5.4-0.2 1.2-0.8 2.4-1.7 3.2-0.3 0.3 0 0.8 0.4 0.7 1.9-0.3 3.5-1 4.6-1.8 1.1 0.4 2.3 0.6 3.5 0.6 5.1 0 9.2-3.6 9.2-8S17.1 3 12 3z" fill="currentColor"/></svg>`,ne=`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,C={...t},w=!1,T=null,E=null,D={open:[],close:[]};function O(e){var t;let n=document.getElementById(f);n==null||(t=n.contentWindow)==null||t.postMessage(`${o}${JSON.stringify(e)}`,`*`)}function k(e){if(typeof e.data==`string`&&e.data.startsWith(o))try{let t=JSON.parse(e.data.slice(20));t.event===`close`&&w&&Y(),t.event===`ready`&&(O({event:w?`open`:`close`}),O({event:`viewport`,viewport:N()})),t.event===`input-focus`&&w&&(T==null||T(),E==null||E())}catch{}}var A=`eperf-theme`;function j(){if(C.theme===`light`||C.theme===`dark`)return C.theme;let e=document.documentElement.getAttribute(`data-theme`);if(e===`dark`||e===`light`)return e;try{let e=localStorage.getItem(A);if(e===`dark`||e===`light`)return e}catch{}return`light`}function re(){typeof window.matchMedia==`function`&&window.matchMedia(`(max-width: ${v}px)`).addEventListener(`change`,()=>{O({event:`viewport`,viewport:N()}),K()})}function ie(){let e=()=>{M(),O({event:`theme`,theme:j()})};new MutationObserver(e).observe(document.documentElement,{attributes:!0,attributeFilter:[`data-theme`]}),window.addEventListener(`storage`,t=>{t.key===A&&e()})}function M(){let e=document.getElementById(m);if(!e)return;if(C.color){e.style.background=C.color;return}e.style.removeProperty(`background`);let t=j();e.style.setProperty(`--ep-sdk-gold`,n[t]),e.style.setProperty(`--ep-sdk-gold-hover`,r[t]),e.style.setProperty(`--ep-sdk-on-gold`,i[t])}function ae(e){let t=j();e.style.setProperty(`--ep-sdk-gold`,n[t]),e.style.setProperty(`--ep-sdk-gold-hover`,r[t]),e.style.setProperty(`--ep-sdk-card2`,ee[t]),e.style.setProperty(`--ep-sdk-text`,a[t])}function oe(){var e;return(e=C.color)==null?n[j()]:e}function N(){return typeof window.matchMedia==`function`&&window.matchMedia(`(max-width: ${v}px)`).matches?`mobile`:`desktop`}function se(){let e=new URL(C.widgetUrl,window.location.href);return e.searchParams.set(`apiUrl`,C.apiUrl),e.searchParams.set(`siteId`,C.siteId),e.searchParams.set(`color`,oe()),e.searchParams.set(`theme`,j()),e.searchParams.set(`viewport`,N()),C.blogIndexUrl&&e.searchParams.set(`indexUrl`,C.blogIndexUrl),e.toString()}function ce(){if(document.getElementById(f))return;let e=document.createElement(`div`);e.id=p,e.className=`ep-holder--${C.position}`,e.setAttribute(`aria-hidden`,`true`);let t=document.createElement(`iframe`);t.id=f,t.src=se(),t.title=`Assistant ePerformance`,t.allow=`clipboard-write`,e.appendChild(t),document.body.appendChild(e)}function P(){if(document.getElementById(m))return;let e=document.createElement(`button`);e.id=m,e.type=`button`,e.className=`ep-bubble--${C.position}`,e.setAttribute(`aria-label`,`Ouvrir le chat`),e.innerHTML=S,e.addEventListener(`click`,X),document.body.appendChild(e),M()}function F(){if(typeof document>`u`)return!1;let e=document.querySelector(s);if(!e||e.hidden)return!1;let t=window.getComputedStyle(e);return t.display!==`none`&&t.visibility!==`hidden`}function I(){if(typeof document>`u`)return;let e=F();for(let n of[m,h,p]){var t;(t=document.getElementById(n))==null||t.classList.toggle(c,e)}}var L=null,R=null;function z(){L==null||L.disconnect(),R==null||R.disconnect(),I();let e=document.body;if(e&&(L=new MutationObserver(()=>I()),L.observe(e,{childList:!0,subtree:!0,attributes:!0,attributeFilter:[`hidden`,`style`,`class`]}),typeof IntersectionObserver<`u`)){let e=document.querySelector(s);e&&(R=new IntersectionObserver(()=>I(),{threshold:[0,1]}),R.observe(e))}}var B=8;function V(){if(typeof document>`u`)return 0;let e=document.querySelector(u);if(!e||e.hidden)return 0;let t=window.getComputedStyle(e);if(t.display===`none`||t.visibility===`hidden`)return 0;let n=e.getBoundingClientRect();return n.height<=0||!(n.bottom>=window.innerHeight-2)?0:Math.ceil(n.height)+B}function H(){if(typeof document>`u`)return;let e=V(),t=`${e}px`;for(let n of[m,h,p]){let r=document.getElementById(n);r&&(e>0?r.style.setProperty(d,t):r.style.removeProperty(d))}}var U=null,W=null,G=!1;function K(){if(G)return;G=!0;let e=()=>{G=!1,H()};typeof requestAnimationFrame==`function`?requestAnimationFrame(e):setTimeout(e,0)}function le(){U==null||U.disconnect(),W==null||W.disconnect(),H();let e=document.body;if(e){if(U=new MutationObserver(K),U.observe(e,{childList:!0,subtree:!0,attributes:!0,attributeFilter:[`hidden`,`style`,`class`]}),typeof ResizeObserver<`u`){let e=document.querySelector(u);e&&(W=new ResizeObserver(K),W.observe(e))}window.addEventListener(`resize`,K),window.addEventListener(`orientationchange`,K)}}function q(e){let t=document.getElementById(m);t&&(t.innerHTML=e)}function J(){var e,t,n;w||(w=!0,Q(),sessionStorage.setItem(g,`1`),(e=document.getElementById(p))==null||e.classList.add(`ep-holder--visible`),(t=document.getElementById(p))==null||t.removeAttribute(`aria-hidden`),(n=document.getElementById(m))==null||n.classList.add(`ep-bubble--open`),q(ne),O({event:`open`,theme:j(),viewport:N()}),T==null||T(),I(),H(),D.open.forEach(e=>e()))}function Y(){var e,t,n;w&&(w=!1,sessionStorage.removeItem(g),(e=document.getElementById(p))==null||e.classList.remove(`ep-holder--visible`),(t=document.getElementById(p))==null||t.setAttribute(`aria-hidden`,`true`),(n=document.getElementById(m))==null||n.classList.remove(`ep-bubble--open`),q(S),O({event:`close`}),I(),H(),D.close.forEach(e=>e()))}function X(){w?Y():J()}function ue(){let e=window.visualViewport;if(!e)return;let t=()=>{let t=document.getElementById(p);t&&w&&window.matchMedia(`(max-width: ${v}px)`).matches&&(window.innerHeight-e.height>150||e.offsetTop>4?(t.style.setProperty(`top`,`${Math.round(e.offsetTop)}px`,`important`),t.style.setProperty(`height`,`${Math.round(e.height)}px`,`important`),t.style.setProperty(`bottom`,`auto`,`important`)):(t.style.removeProperty(`top`),t.style.removeProperty(`height`),t.style.removeProperty(`bottom`)))};e.addEventListener(`resize`,t),e.addEventListener(`scroll`,t),window.addEventListener(`resize`,t);let n=()=>{setTimeout(t,350),setTimeout(t,800)};e.addEventListener(`resize`,n),T=t,E=n}function de(){let e=document.createElement(`style`);e.textContent=x,document.head.appendChild(e)}function Z(){window.ePerformance={open:J,close:Y,toggle:X,identify:(e,t={})=>O({event:`identify`,userId:e,userData:t}),on:(e,t)=>{(e===`open`||e===`close`)&&D[e].push(t)}}}function Q(){var e;sessionStorage.setItem(_,`1`),(e=document.getElementById(h))==null||e.remove()}function fe(){sessionStorage.getItem(_)||setTimeout(()=>{if(w||sessionStorage.getItem(_))return;let e=document.createElement(`div`);e.id=h,e.setAttribute(`role`,`button`),e.setAttribute(`tabindex`,`0`),e.innerHTML=`<span>Une question sur votre business ?</span><button type="button" aria-label="Masquer">✕</button>`,e.addEventListener(`click`,e=>{e.target.tagName===`BUTTON`?Q():J()}),ae(e),document.body.appendChild(e),H(),sessionStorage.setItem(_,`1`),requestAnimationFrame(()=>e.classList.add(`ep-teaser--visible`)),I()},y)}function pe(){window.addEventListener(`keydown`,e=>{e.key===`Escape`&&w&&Y()})}function $(){C={...t,...window.ePerformanceConfig},de(),ce(),P(),window.addEventListener(`message`,k),ue(),pe(),ie(),re(),z(),le(),Z(),sessionStorage.getItem(g)===`1`?J():fe()}return document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,$,{once:!0}):$(),e.initSdk=$,e})({});