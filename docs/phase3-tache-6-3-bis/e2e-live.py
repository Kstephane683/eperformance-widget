#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Validation EN PRODUCTION — les corrections qui ne se prouvent qu'en vrai.

Le widget servi par GitHub Pages est chargé dans une page hôte, avec le VRAI
backend Railway (aucune interception réseau) :

  · A.5 — « Bonjour » : la réponse est-elle naturelle (aucun canevas) ?
  · A.8 — clic sur une suggestion : la réponse démontre-t-elle la compétence ?
  · A.1 — image jointe : Mia la décrit-elle (sans demander de la décrire) ?
  · A.6 — aucun nom d'agent n'apparaît à l'écran.

Les réponses sont écrites dans `e2e-live-resultats.json` (preuve textuelle) et
capturées en images.

    python3 e2e-live.py
"""

from __future__ import annotations

import base64
import json
import struct
import time
import zlib
from pathlib import Path

from playwright.sync_api import sync_playwright

DOSSIER = Path(__file__).resolve().parent
WIDGET = "https://kstephane683.github.io/eperformance-widget/"
TIMEOUT_REPONSE = 90_000


def png_vert(w: int = 240, h: int = 240) -> bytes:
    """PNG uni vert — la couleur attendue dans la description est connue."""
    def chunk(tag: bytes, data: bytes) -> bytes:
        corps = tag + data
        return struct.pack(">I", len(data)) + corps + struct.pack(">I", zlib.crc32(corps) & 0xFFFFFFFF)

    lignes = [b"\x00" + bytes((30, 150, 70)) * w for _ in range(h)]
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(b"".join(lignes)))
        + chunk(b"IEND", b"")
    )


HOTE = """<!doctype html>
<html lang="fr" data-theme="light">
<head><meta charset="utf-8"><title>E2E production</title>
<style>html,body{margin:0;height:100%}iframe{width:400px;height:650px;border:0;
position:absolute;right:24px;bottom:24px;box-shadow:0 12px 32px rgba(0,0,0,.2)}</style>
</head><body>
<iframe id="w" title="Assistant ePerformance"></iframe>
<script>
  const u = new URL(WIDGET_URL);
  u.searchParams.set('apiUrl', 'https://web-production-4ab53.up.railway.app');
  u.searchParams.set('siteId', 'eperformance_vitrine');
  u.searchParams.set('theme', 'light');
  u.searchParams.set('viewport', 'desktop');
  u.searchParams.set('indexUrl', 'https://blog.eperformance.pro');
  document.getElementById('w').src = u.toString();
</script>
</body></html>
"""


def texte_derniere_reponse(frame) -> str:
    bulles = frame.locator(".ep-bubble--agent")
    n = bulles.count()
    return bulles.nth(n - 1).inner_text() if n else ""


def attendre_reponse(frame, precedent: int, timeout: int = TIMEOUT_REPONSE) -> str:
    """Attend qu'une NOUVELLE bulle agent apparaisse et que la frappe cesse."""
    fin = time.time() + timeout / 1000
    while time.time() < fin:
        if frame.locator(".ep-bubble--agent").count() > precedent:
            time.sleep(1.0)
            if frame.locator(".ep-typing, .ep-typing-indicator").count() == 0:
                return texte_derniere_reponse(frame)
        time.sleep(0.5)
    return ""


def main() -> None:
    resultats: dict = {}
    (DOSSIER / "_hote-e2e.html").write_text(
        HOTE.replace("WIDGET_URL", f"'{WIDGET}'"), encoding="utf-8"
    )
    image = DOSSIER / "_e2e-visuel.png"
    image.write_bytes(png_vert())

    with sync_playwright() as p:
        navigateur = p.chromium.launch()
        contexte = navigateur.new_context(viewport={"width": 1280, "height": 720})
        page = contexte.new_page()
        page.goto(f"file://{DOSSIER / '_hote-e2e.html'}")
        page.wait_for_selector("#w")
        time.sleep(2.5)
        frame = page.frame_locator("#w")

        # ---------------- A.4 / A.5 — ouverture et premier message ----------------
        frame.locator(".ep-saisie").click()
        time.sleep(1.2)
        accueil = frame.locator(".ep-bubble--agent").first.inner_text()
        resultats["A4_message_ouverture"] = accueil

        champ = frame.locator(".ep-input")
        champ.fill("Bonjour")
        champ.press("Enter")
        resultats["A5_reponse_bonjour"] = attendre_reponse(frame, 1)
        page.screenshot(path=str(DOSSIER / "live-A4-A5-bonjour.png"))

        # ---------------- A.8 — suggestion SEO ----------------
        # Retour depuis la conversation (le header ramène à la liste), puis
        # onglet Accueil : c'est là que vivent les suggestions.
        frame.locator("[aria-label='Revenir à la liste des conversations']").first.click()
        time.sleep(0.8)
        frame.locator("#ep-tab-home").click()
        time.sleep(0.8)
        avant = frame.locator(".ep-bubble--agent").count()
        frame.locator("[data-suggestion='seo']").first.click()
        time.sleep(1.2)
        resultats["A8_bulle_visiteur"] = frame.locator(".ep-bubble--user").last.inner_text()
        resultats["A8_reponse_seo"] = attendre_reponse(frame, avant)
        page.screenshot(path=str(DOSSIER / "live-A8-suggestion-seo.png"))

        # ---------------- A.1 — image jointe ----------------
        avant = frame.locator(".ep-bubble--agent").count()
        frame.locator("input[type=file]").set_input_files(str(image))
        time.sleep(1.2)
        resultats["A1_apercu_piece"] = frame.locator(".ep-piece__nom").inner_text()
        accessibles = frame.locator("[aria-label='Votre message']")
        accessibles.fill("Qu'est-ce que tu penses de ce visuel pour ma page Facebook ?")
        frame.locator(".ep-send").click()
        resultats["A1_reponse_image"] = attendre_reponse(frame, avant)
        page.screenshot(path=str(DOSSIER / "live-A1-image.png"))

        # ---------------- A.6 — aucun nom d'agent à l'écran ----------------
        tout = frame.locator(".ep-chat").inner_text()
        cles = [
            "sales-discovery-coach",
            "sales-outbound-strategist",
            "marketing-seo-specialist",
            "discovery coach",
            "expert sales",
            "agent IA ePerformance",
        ]
        resultats["A6_texte_ecran"] = tout
        resultats["A6_fuites"] = [c for c in cles if c.lower() in tout.lower()]

        contexte.close()
        navigateur.close()

    (DOSSIER / "e2e-live-resultats.json").write_text(
        json.dumps(resultats, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(json.dumps(resultats, indent=2, ensure_ascii=False)[:4000])


if __name__ == "__main__":
    main()
