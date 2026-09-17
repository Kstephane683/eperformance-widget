var ePerformanceSDK=(function(e){Object.defineProperty(e,Symbol.toStringTag,{value:`Module`});var t={widgetUrl:`http://localhost:4173`,apiUrl:`https://web-production-4ab53.up.railway.app`,siteId:`eperformance_vitrine`,color:`#c9a96e`,position:`right`},n=`eperformance-widget:`,r=2147483e3,i=`eperformance-widget-frame`,a=`eperformance-widget-holder`,o=`eperformance-widget-bubble`,s=`eperformance-widget-teaser`,c=`eperf_widget_open`,l=`eperf_teaser_done`,u=668,d=2e4,f=`
#${a} {
  position: fixed !important;
  bottom: 88px;
  width: 400px;
  max-width: calc(100vw - 40px);
  height: min(650px, calc(100dvh - 110px));
  z-index: ${r} !important;
  opacity: 0;
  visibility: hidden;
  transform: translateY(24px) scale(0.98);
  transition: opacity 0.25s ease, transform 0.25s ease, visibility 0.25s;
  pointer-events: none;
}
#${a}.ep-holder--right { right: 20px; }
#${a}.ep-holder--left { left: 20px; }
#${a}.ep-holder--visible {
  opacity: 1;
  visibility: visible;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}
#${i} {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
}
#${o} {
  position: fixed !important;
  bottom: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  z-index: 2147483001 !important;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35), 0 0 0 6px rgba(201, 169, 110, 0.15);
  transition: transform 0.15s ease;
  color: #0a0a0e;
}
#${o}:hover { transform: scale(1.06); }
#${o}.ep-bubble--right { right: 20px; }
#${o}.ep-bubble--left { left: 20px; }
@media (max-width: ${u}px) {
  #${a} {
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
  #${i} { border-radius: 0; }
  #${o}.ep-bubble--right, #${o}.ep-bubble--left { right: 16px; }
  /* Widget ouvert en plein écran : la bubble-croix masquerait l'input —
     le bouton fermer est dans le header du widget */
  #${o}.ep-bubble--open { display: none !important; }
  #${s} { right: 16px; bottom: 88px; }
}

/* Accessibilité : réduire les animations si demandé par le système */
@media (prefers-reduced-motion: reduce) {
  #${a}, #${o}, #${s} {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Teaser proactif (pattern Intercom/Drift — héritage v6.0) */
#${s} {
  position: fixed !important;
  bottom: 88px;
  right: 20px;
  z-index: 2147483002 !important;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 280px;
  padding: 12px 14px;
  border-radius: 14px 14px 4px 14px;
  background: #14141a;
  color: #edeae3;
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.45;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(201, 169, 110, 0.25);
  cursor: pointer;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.3s ease, transform 0.3s ease;
}
#${s}.ep-teaser--visible {
  opacity: 1;
  transform: translateY(0);
}
#${s} button {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: rgba(201, 169, 110, 0.15);
  color: #c9a96e;
  font-size: 11px;
  cursor: pointer;
}
`,p=`<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3C6.9 3 2.8 6.6 2.8 11c0 2.1 0.9 4 2.4 5.4-0.2 1.2-0.8 2.4-1.7 3.2-0.3 0.3 0 0.8 0.4 0.7 1.9-0.3 3.5-1 4.6-1.8 1.1 0.4 2.3 0.6 3.5 0.6 5.1 0 9.2-3.6 9.2-8S17.1 3 12 3z" fill="currentColor"/></svg>`,m=`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,h={...t},g=!1,_=null,v=null,y={open:[],close:[]};function b(e){var t;let r=document.getElementById(i);r==null||(t=r.contentWindow)==null||t.postMessage(`${n}${JSON.stringify(e)}`,`*`)}function x(e){if(typeof e.data==`string`&&e.data.startsWith(n))try{let t=JSON.parse(e.data.slice(20));t.event===`close`&&g&&D(),t.event===`ready`&&b({event:g?`open`:`close`}),t.event===`input-focus`&&g&&(_==null||_(),v==null||v())}catch{}}function S(){let e=new URL(h.widgetUrl,window.location.href);return e.searchParams.set(`apiUrl`,h.apiUrl),e.searchParams.set(`siteId`,h.siteId),e.searchParams.set(`color`,h.color),e.toString()}function C(){if(document.getElementById(i))return;let e=document.createElement(`div`);e.id=a,e.className=`ep-holder--${h.position}`,e.setAttribute(`aria-hidden`,`true`);let t=document.createElement(`iframe`);t.id=i,t.src=S(),t.title=`Assistant ePerformance`,t.allow=`clipboard-write`,e.appendChild(t),document.body.appendChild(e)}function w(){if(document.getElementById(o))return;let e=document.createElement(`button`);e.id=o,e.type=`button`,e.className=`ep-bubble--${h.position}`,e.setAttribute(`aria-label`,`Ouvrir le chat`),e.style.background=`linear-gradient(135deg, ${h.color} 0%, #e2c07a 100%)`,e.innerHTML=p,e.addEventListener(`click`,O),document.body.appendChild(e)}function T(e){let t=document.getElementById(o);t&&(t.innerHTML=e)}function E(){var e,t,n;g||(g=!0,M(),sessionStorage.setItem(c,`1`),(e=document.getElementById(a))==null||e.classList.add(`ep-holder--visible`),(t=document.getElementById(a))==null||t.removeAttribute(`aria-hidden`),(n=document.getElementById(o))==null||n.classList.add(`ep-bubble--open`),T(m),b({event:`open`}),_==null||_(),y.open.forEach(e=>e()))}function D(){var e,t,n;g&&(g=!1,sessionStorage.removeItem(c),(e=document.getElementById(a))==null||e.classList.remove(`ep-holder--visible`),(t=document.getElementById(a))==null||t.setAttribute(`aria-hidden`,`true`),(n=document.getElementById(o))==null||n.classList.remove(`ep-bubble--open`),T(p),b({event:`close`}),y.close.forEach(e=>e()))}function O(){g?D():E()}function k(){let e=window.visualViewport;if(!e)return;let t=()=>{let t=document.getElementById(a);t&&g&&window.matchMedia(`(max-width: ${u}px)`).matches&&(window.innerHeight-e.height>150||e.offsetTop>4?(t.style.setProperty(`top`,`${Math.round(e.offsetTop)}px`,`important`),t.style.setProperty(`height`,`${Math.round(e.height)}px`,`important`),t.style.setProperty(`bottom`,`auto`,`important`)):(t.style.removeProperty(`top`),t.style.removeProperty(`height`),t.style.removeProperty(`bottom`)))};e.addEventListener(`resize`,t),e.addEventListener(`scroll`,t),window.addEventListener(`resize`,t);let n=()=>{setTimeout(t,350),setTimeout(t,800)};e.addEventListener(`resize`,n),_=t,v=n}function A(){let e=document.createElement(`style`);e.textContent=f,document.head.appendChild(e)}function j(){window.ePerformance={open:E,close:D,toggle:O,identify:(e,t={})=>b({event:`identify`,userId:e,userData:t}),on:(e,t)=>{(e===`open`||e===`close`)&&y[e].push(t)}}}function M(){var e;sessionStorage.setItem(l,`1`),(e=document.getElementById(s))==null||e.remove()}function N(){sessionStorage.getItem(l)||setTimeout(()=>{if(g||sessionStorage.getItem(l))return;let e=document.createElement(`div`);e.id=s,e.setAttribute(`role`,`button`),e.setAttribute(`tabindex`,`0`),e.innerHTML=`<span>Une question sur votre business ?</span><button type="button" aria-label="Masquer">✕</button>`,e.addEventListener(`click`,e=>{e.target.tagName===`BUTTON`?M():E()}),document.body.appendChild(e),sessionStorage.setItem(l,`1`),requestAnimationFrame(()=>e.classList.add(`ep-teaser--visible`))},d)}function P(){window.addEventListener(`keydown`,e=>{e.key===`Escape`&&g&&D()})}function F(){h={...t,...window.ePerformanceConfig},A(),C(),w(),window.addEventListener(`message`,x),k(),P(),j(),sessionStorage.getItem(c)===`1`?E():N()}return document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,F,{once:!0}):F(),e.initSdk=F,e})({});