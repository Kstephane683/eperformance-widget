#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Captures et mesures de la tâche 6.2-bis.

Ce script produit, dans ce dossier :
  · les captures des 5 écrans du widget (Accueil, Messages, Aide, Actualités,
    Conversation) en clair et en sombre, en desktop 1280×720 et mobile 390×844 ;
  · les captures AVANT / APRÈS du bug `.sticky-cta` sur les gabarits mobiles
    demandés (iPhone 14 Pro Max 430×932, iPhone SE 375×667, Galaxy S20 360×800,
    plus 390×844) ;
  · `mesures-sticky-cta.json` : rectangles mesurés et surfaces de
    chevauchement bulle ↔ bouton WhatsApp de la barre CTA.

Il sert un serveur statique à la racine /home/ballo/OX6A (le harnais, le
site, le blog et le build du widget sont lus tels quels — aucun dépôt n'est
modifié).

LIMITE ASSUMÉE : les émulateurs Android/iOS ne sont pas installables dans cet
environnement (SDK Android absent ; iOS exige macOS/Xcode). La validation se
fait donc par émulation de viewport dans un vrai moteur de rendu (Chromium via
Playwright), ce qui couvre la mise en page CSS, la barre d'onglets, la zone de
saisie et le chevauchement avec la barre CTA — mais PAS les comportements
propres à un appareil (clavier iOS, safe-area réelles, Web Speech API mobile).

    python3 captures.py            # tout
    python3 captures.py bug        # seulement les mesures avant/après
"""

from __future__ import annotations

import functools
import http.server
import json
import socketserver
import subprocess
import sys
import threading
import time
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

RACINE_SERVEUR = Path("/home/ballo/OX6A")
DOSSIER = Path(__file__).resolve().parent
HARNAIS = "/toolkit_eperformance/eperformance-widget/docs/phase3-tache-6-2-bis/hote-mobile.html"
PORT = 8099
BASE = f"http://127.0.0.1:{PORT}"

CADRES = {"desktop": {"width": 1280, "height": 720}, "mobile": {"width": 390, "height": 844}}

# Gabarits mobiles réels (validation du bug)
GABARITS_BUG = [
    ("iphone-14-pro-max", 430, 932),
    ("iphone-se", 375, 667),
    ("galaxy-s20", 360, 800),
    ("mobile-390x844", 390, 844),
]

ECRANS = [
    ("accueil", "home", None),
    ("messages", "messages", None),
    ("aide", "aide", None),
    ("actualites", "actualites", None),
    ("conversation", "conversation", "messages"),
]

MESSAGE_CAPTURE = "Bonjour, comment calculer mon vrai CAC ?"


# --------------------------------------------------------------------------
# Serveur statique
# --------------------------------------------------------------------------


API_RAILWAY = "https://web-production-4ab53.up.railway.app"


class ServeurSilencieux(http.server.SimpleHTTPRequestHandler):
    """Serveur statique + proxy API pour les captures.

    Le proxy `/api-railway/*` ne sert qu'aux captures : l'API Railway
    n'autorise en CORS que ses origines de production, un harnais localhost
    serait bloqué par le navigateur. Le widget, lui, ne change pas d'une
    ligne — il appelle la même route, avec les mêmes corps de requête.
    """

    def log_message(self, *args):  # noqa: D102 - silence volontaire
        pass

    def _proxy(self) -> None:
        from urllib.parse import urlsplit
        from urllib.request import Request, urlopen

        chemin = urlsplit(self.path).path.replace("/api-railway", "", 1)
        longueur = int(self.headers.get("Content-Length") or 0)
        corps = self.rfile.read(longueur) if longueur else None
        requete = Request(
            f"{API_RAILWAY}{chemin}",
            data=corps,
            method=self.command,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urlopen(requete, timeout=45) as reponse:
                donnees = reponse.read()
                statut = reponse.status
        except Exception as erreur:  # noqa: BLE001 - remonté au client
            donnees, statut = json.dumps({"detail": str(erreur)}).encode(), 502
        self.send_response(statut)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(donnees)))
        self.end_headers()
        self.wfile.write(donnees)

    def do_POST(self):  # noqa: N802 - API http.server
        if self.path.startswith("/api-railway/"):
            self._proxy()
        else:
            self.send_error(404)

    def do_OPTIONS(self):  # noqa: N802 - API http.server
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.end_headers()


def demarrer_serveur() -> socketserver.TCPServer:
    handler = functools.partial(ServeurSilencieux, directory=str(RACINE_SERVEUR))
    socketserver.TCPServer.allow_reuse_address = True
    serveur = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    return serveur


# --------------------------------------------------------------------------
# Aides de navigation
# --------------------------------------------------------------------------


def attendre_widget(page: Page) -> None:
    page.wait_for_selector("#eperformance-widget-bubble", state="attached")
    page.wait_for_selector("#eperformance-widget-frame", state="attached")
    page.wait_for_timeout(500)


def ouvrir_widget(page: Page) -> None:
    page.click("#eperformance-widget-bubble")
    cadre = page.frame_locator("#eperformance-widget-frame")
    cadre.locator(".ep-app").wait_for(state="visible", timeout=15_000)
    page.wait_for_timeout(400)
    return cadre


def aller_onglet(page: Page, cadre, nom: str) -> None:
    """Depuis un écran d'onglet. En desktop, la conversation n'affiche pas la
    barre d'onglets : on repasse d'abord par le retour du header."""
    if cadre.locator(".ep-chat").count():
        cadre.locator('button[aria-label^="Revenir"]').click()
        page.wait_for_timeout(400)
    cadre.locator(f"#ep-tab-{nom}").click()
    page.wait_for_timeout(450)


def capturer(page: Page, nom: str) -> None:
    chemin = DOSSIER / f"{nom}.png"
    page.screenshot(path=str(chemin))
    print(f"    capture : {chemin.name}")


def basculer_theme(page: Page, theme: str) -> None:
    """Le SDK observe data-theme sur la page hôte et propage à l'iframe."""
    page.evaluate(
        """(theme) => {
            document.documentElement.setAttribute('data-theme', theme)
            try { localStorage.setItem('eperf-theme', theme) } catch (e) {}
        }""",
        theme,
    )
    page.wait_for_timeout(700)


def capturer_ecrans(page: Page, cadre, prefixe: str) -> None:
    """Les 5 écrans, dans l'ordre, sur une session déjà ouverte."""
    aller_onglet(page, cadre, "home")
    capturer(page, f"{prefixe}-accueil")

    # Conversation : on envoie un vrai message pour montrer le fil complet
    aller_onglet(page, cadre, "messages")
    capturer(page, f"{prefixe}-messages")

    cadre.locator(".ep-ligne").first.click()
    page.wait_for_timeout(600)
    champ = cadre.locator("input.ep-input")
    champ.click()
    # L'écran d'accueil a pu préremplir le champ (intention) : on repart de zéro
    champ.fill("")
    champ.fill(MESSAGE_CAPTURE)
    champ.press("Enter")
    page.wait_for_timeout(8_000)  # réponse de Mia (backend Railway, réel)
    capturer(page, f"{prefixe}-conversation")

    aller_onglet(page, cadre, "aide")
    capturer(page, f"{prefixe}-aide")
    first = cadre.locator(".ep-ligne").first
    if first.count():
        first.click()
        page.wait_for_timeout(450)
        capturer(page, f"{prefixe}-aide-collection")
        cadre.locator(".ep-retour").click()
        page.wait_for_timeout(300)

    aller_onglet(page, cadre, "actualites")
    capturer(page, f"{prefixe}-actualites")


# --------------------------------------------------------------------------
# Bug `.sticky-cta` : mesure
# --------------------------------------------------------------------------

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
    const rBarre = rect(barre)
    const rWhatsapp = rect(whatsapp)
    const rBulle = rect(bulle)
    return {
        fenetre: { w: window.innerWidth, h: window.innerHeight },
        barre_cta: rBarre,
        bouton_whatsapp: rWhatsapp,
        bulle: rBulle,
        marge_bas_bulle: bulle ? getComputedStyle(bulle).bottom : null,
        chevauchement_bulle_whatsapp_px2: intersection(rBulle, rWhatsapp),
        chevauchement_bulle_barre_px2: intersection(rBulle, rBarre),
    }
}"""


def mesurer_bug(page: Page, largeur: int, hauteur: int, sdk: str) -> dict:
    page.set_viewport_size({"width": largeur, "height": hauteur})
    page.goto(f"{BASE}{HARNAIS}?sdk={sdk}", wait_until="load")
    attendre_widget(page)
    page.wait_for_timeout(600)
    mesures = page.evaluate(MESURE_JS)
    capturer(page, f"bug-{'avant' if sdk == 'avant' else 'apres'}-{largeur}x{hauteur}")
    return mesures


# --------------------------------------------------------------------------
# Programme
# --------------------------------------------------------------------------


def phase_bug(playwright) -> dict:
    print("  · bug .sticky-cta (avant / après)")
    resultats = {}
    navigateur = playwright.chromium.launch()
    for nom, largeur, hauteur in GABARITS_BUG:
        contexte = navigateur.new_context(viewport={"width": largeur, "height": hauteur})
        page = contexte.new_page()
        avant = mesurer_bug(page, largeur, hauteur, "avant")
        apres = mesurer_bug(page, largeur, hauteur, "apres")
        resultats[nom] = {"avant": avant, "apres": apres}
        print(
            f"    {nom} {largeur}×{hauteur} : "
            f"chevauchement {avant['chevauchement_bulle_whatsapp_px2']} px² → "
            f"{apres['chevauchement_bulle_whatsapp_px2']} px²"
        )
        contexte.close()
    navigateur.close()
    (DOSSIER / "mesures-sticky-cta.json").write_text(
        json.dumps(resultats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("    mesures : mesures-sticky-cta.json")
    return resultats


def phase_ecrans(playwright) -> None:
    print("  · 5 écrans (clair + sombre, desktop + mobile)")
    navigateur = playwright.chromium.launch()
    for cadre_nom, taille in CADRES.items():
        contexte = navigateur.new_context(
            viewport=taille,
            device_scale_factor=1,
            has_touch=cadre_nom == "mobile",
            is_mobile=cadre_nom == "mobile",
        )
        page = contexte.new_page()
        page.goto(f"{BASE}{HARNAIS}?sdk=apres&api=/api-railway", wait_until="load")
        attendre_widget(page)
        cadre = ouvrir_widget(page)
        capturer_ecrans(page, cadre, f"clair-{cadre_nom}")

        basculer_theme(page, "dark")
        capturer_ecrans(page, cadre, f"sombre-{cadre_nom}")
        contexte.close()
    navigateur.close()


def main() -> int:
    serveur = demarrer_serveur()
    time.sleep(0.4)
    phases = sys.argv[1:] or ["bug", "ecrans"]
    try:
        with sync_playwright() as playwright:
            if "bug" in phases:
                phase_bug(playwright)
            if "ecrans" in phases:
                phase_ecrans(playwright)
    finally:
        serveur.shutdown()
    subprocess.run(["ls", "-la", str(DOSSIER)], check=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
