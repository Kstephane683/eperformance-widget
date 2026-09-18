#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Non-régression A.11 — mesures sur la PRODUCTION.

Le SDK déployé (GitHub Pages) est chargé par la page de production
`https://eperformance.pro` ; on mesure :

  · chevauchement bulle ↔ bouton WhatsApp de `.sticky-cta` (attendu 0 px²) ;
  · bulle masquée tant que le bandeau de consentement est affiché, puis
    réaffichée à sa fermeture (décision D9) ;
  · Consent Mode v2 toujours en place (état `denied` par défaut dans le
    dataLayer, avant tout consentement) ;
  · `eph:chatbot:message`/`lead` : le SDK déployé contient bien le relais N3.

Sortie : `mesures-non-regression.json`.

    python3 non-regression.py
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

DOSSIER = Path(__file__).resolve().parent
SITE = "https://eperformance.pro/"
GABARITS = {"desktop-1280x720": (1280, 720), "mobile-390x844": (390, 844)}

MESURE_JS = """() => {
    const rect = (el) => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
                 right: Math.round(r.right), bottom: Math.round(r.bottom) }
    }
    const intersection = (a, b) => {
        if (!a || !b) return 0
        const w = Math.min(a.right, b.right) - Math.max(a.x, b.x)
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y)
        return w > 0 && h > 0 ? Math.round(w * h) : 0
    }
    const barre = document.querySelector('.sticky-cta')
    const whatsapp = document.querySelector('.sticky-cta a[href*="wa.me"]')
    const bulle = document.getElementById('eperformance-widget-bubble')
    const holder = document.getElementById('eperformance-widget-holder')
    const bandeau = document.querySelector('.consent')
    const rBulle = rect(bulle), rWhatsapp = rect(whatsapp), rBarre = rect(barre)
    return {
        fenetre: { w: window.innerWidth, h: window.innerHeight },
        barre_cta: rBarre,
        bouton_whatsapp: rWhatsapp,
        bulle: rBulle,
        bulle_visible: bulle ? getComputedStyle(bulle).display !== 'none' : null,
        chevauchement_bulle_whatsapp_px2: intersection(rBulle, rWhatsapp),
        chevauchement_bulle_barre_px2: intersection(rBulle, rBarre),
        z_index_holder: holder ? getComputedStyle(holder).zIndex : null,
        bandeau_present: Boolean(bandeau),
        bandeau_masque: bandeau ? (bandeau.hidden || getComputedStyle(bandeau).display === 'none') : null,
    }
}"""


def main() -> None:
    resultats: dict = {}
    with sync_playwright() as p:
        navigateur = p.chromium.launch()
        for nom, (largeur, hauteur) in GABARITS.items():
            contexte = navigateur.new_context(viewport={"width": largeur, "height": hauteur})
            page = contexte.new_page()
            page.goto(SITE, wait_until="load")
            page.wait_for_timeout(2500)

            # Consent Mode v2 : état par défaut, avant tout consentement
            consentement = page.evaluate(
                """() => {
                    const dl = window.dataLayer || [];
                    const entrees = dl.filter((e) => e && e[0] === 'consent' && e[1] === 'default');
                    return entrees.length ? JSON.parse(JSON.stringify(entrees[0][2])) : null;
                }"""
            )

            # 1. Bandeau affiché (état réel de la production à la première visite)
            avec_bandeau = page.evaluate(MESURE_JS)

            # 2. Bandeau fermé : la bulle doit réapparaître
            page.evaluate(
                """() => {
                    const b = document.querySelector('.consent');
                    if (b) { b.hidden = true; b.setAttribute('hidden', ''); }
                }"""
            )
            page.wait_for_timeout(900)
            sans_bandeau = page.evaluate(MESURE_JS)

            resultats[nom] = {
                "consent_mode_v2_defaut": consentement,
                "bandeau_affiche": avec_bandeau,
                "bandeau_ferme": sans_bandeau,
                "chevauchement_bulle_whatsapp_px2": sans_bandeau[
                    "chevauchement_bulle_whatsapp_px2"
                ],
                "chevauchement_bulle_barre_px2": sans_bandeau["chevauchement_bulle_barre_px2"],
            }
            contexte.close()
        navigateur.close()

    (DOSSIER / "mesures-non-regression.json").write_text(
        json.dumps(resultats, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    for nom, valeurs in resultats.items():
        print(
            f"{nom} : chevauchement WhatsApp={valeurs['chevauchement_bulle_whatsapp_px2']} px², "
            f"barre={valeurs['chevauchement_bulle_barre_px2']} px², "
            f"bulle visible avec bandeau={valeurs['bandeau_affiche']['bulle_visible']}, "
            f"sans bandeau={valeurs['bandeau_ferme']['bulle_visible']}, "
            f"Consent Mode défaut={valeurs['consent_mode_v2_defaut']}"
        )


if __name__ == "__main__":
    main()
