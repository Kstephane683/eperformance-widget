var ePerformanceSDK=(function(e){Object.defineProperty(e,Symbol.toStringTag,{value:`Module`});var t={widgetUrl:`http://localhost:4173`,apiUrl:`https://web-production-4ab53.up.railway.app`,siteId:`eperformance_vitrine`,color:`#c9a96e`,position:`right`},n=`eperformance-widget:`,r=2147483e3,i=`eperformance-widget-frame`,a=`eperformance-widget-holder`,o=`eperformance-widget-bubble`,s=`
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
@media (max-width: 668px) {
  #${a} {
    right: 0 !important;
    left: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: 100dvh !important;
    max-width: 100%;
    border-radius: 0;
  }
  #${i} { border-radius: 0; }
  #${o}.ep-bubble--right, #${o}.ep-bubble--left { right: 16px; }
}
`,c=`<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3C6.9 3 2.8 6.6 2.8 11c0 2.1 0.9 4 2.4 5.4-0.2 1.2-0.8 2.4-1.7 3.2-0.3 0.3 0 0.8 0.4 0.7 1.9-0.3 3.5-1 4.6-1.8 1.1 0.4 2.3 0.6 3.5 0.6 5.1 0 9.2-3.6 9.2-8S17.1 3 12 3z" fill="currentColor"/></svg>`,l=`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,u={...t},d=!1,f=null,p={open:[],close:[]};function m(e){var t;let r=document.getElementById(i);r==null||(t=r.contentWindow)==null||t.postMessage(`${n}${JSON.stringify(e)}`,`*`)}function h(e){if(typeof e.data==`string`&&e.data.startsWith(n))try{JSON.parse(e.data.slice(20)).event===`close`&&d&&x()}catch{}}function g(){let e=new URL(u.widgetUrl,window.location.href);return e.searchParams.set(`apiUrl`,u.apiUrl),e.searchParams.set(`siteId`,u.siteId),e.searchParams.set(`color`,u.color),e.toString()}function _(){if(document.getElementById(i))return;let e=document.createElement(`div`);e.id=a,e.className=`ep-holder--${u.position}`,e.setAttribute(`aria-hidden`,`true`);let t=document.createElement(`iframe`);t.id=i,t.src=g(),t.title=`Assistant ePerformance`,t.allow=`clipboard-write`,e.appendChild(t),document.body.appendChild(e)}function v(){if(document.getElementById(o))return;let e=document.createElement(`button`);e.id=o,e.type=`button`,e.className=`ep-bubble--${u.position}`,e.setAttribute(`aria-label`,`Ouvrir le chat`),e.style.background=`linear-gradient(135deg, ${u.color} 0%, #e2c07a 100%)`,e.innerHTML=c,e.addEventListener(`click`,S),document.body.appendChild(e)}function y(e){let t=document.getElementById(o);t&&(t.innerHTML=e)}function b(){var e,t;d||(d=!0,(e=document.getElementById(a))==null||e.classList.add(`ep-holder--visible`),(t=document.getElementById(a))==null||t.removeAttribute(`aria-hidden`),y(l),m({event:`open`}),f==null||f(),p.open.forEach(e=>e()))}function x(){var e,t;d&&(d=!1,(e=document.getElementById(a))==null||e.classList.remove(`ep-holder--visible`),(t=document.getElementById(a))==null||t.setAttribute(`aria-hidden`,`true`),y(c),m({event:`close`}),p.close.forEach(e=>e()))}function S(){d?x():b()}function C(){let e=window.visualViewport;if(!e)return;let t=()=>{let t=document.getElementById(a);if(!t||!d)return;let n=window.innerHeight-e.height;n>150?(t.style.setProperty(`height`,`${Math.round(e.height)}px`,`important`),t.style.setProperty(`bottom`,`${Math.round(n+e.offsetTop)}px`,`important`)):(t.style.removeProperty(`height`),t.style.removeProperty(`bottom`))};e.addEventListener(`resize`,t),e.addEventListener(`scroll`,t),window.addEventListener(`resize`,t),f=t}function w(){let e=document.createElement(`style`);e.textContent=s,document.head.appendChild(e)}function T(){window.ePerformance={open:b,close:x,toggle:S,identify:(e,t={})=>m({event:`identify`,userId:e,userData:t}),on:(e,t)=>{(e===`open`||e===`close`)&&p[e].push(t)}}}function E(){u={...t,...window.ePerformanceConfig},w(),_(),v(),window.addEventListener(`message`,h),C(),T()}return document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,E,{once:!0}):E(),e.initSdk=E,e})({});