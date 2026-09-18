#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Assets de fiches de stores — tâche 6.4, Bloc B.

Produit, à partir de l'application réelle (aucune maquette inventée), les
visuels exigés par Google Play et par l'App Store :

  stores/play/
    icone-512.png                 512×512   (reprise de public/icons/mia-512.png)
    graphique-1024x500.png        1024×500  graphique de présentation
    telephone-1080x1920-*.png     1080×1920 captures téléphone (4)
    tablette-7-1200x1920-*.png    1200×1920 captures 7 pouces (2)
    tablette-10-1600x2560-*.png   1600×2560 captures 10 pouces (2)

  stores/app-store/
    icone-1024.png                1024×1024 icône App Store (sans transparence)
    6-9-1320x2868-*.png           1320×2868 captures 6,9 pouces (4)

Les captures sont prises dans un vrai moteur de rendu, à l'échelle exacte
demandée (viewport CSS × device_scale_factor). Les écrans avec conversation
utilisent l'API de production : Mia répond réellement — c'est ce qui est montré
au visiteur du store.

    python3 generer-assets.py        # après `npm run build`
"""

from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from PIL import Image
from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

DEPOT = Path(__file__).resolve().parents[3]  # …/eperformance-widget
DOSSIER = Path(__file__).resolve().parent
PLAY = DOSSIER / "play"
APP_STORE = DOSSIER / "app-store"
PORT = 8106
BASE = f"http://127.0.0.1:{PORT}"
API_PRODUCTION = "https://web-production-4ab53.up.railway.app"

MESSAGE = "Comment trouver plus de clients quand on débute ?"


# --------------------------------------------------------------------------
# Proxy API — le backend de production n'autorise que les origines du site
# (en-tête `vary: Origin`, sans `Access-Control-Allow-Origin` pour 127.0.0.1).
# Le harnais relaie donc les appels vers la vraie API et ajoute l'en-tête
# manquant : Mia répond réellement — seule la transportée est locale.
# --------------------------------------------------------------------------

import json
import urllib.error
import urllib.request


class ServeurSilencieux(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):  # type: ignore[override]
        pass

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def do_OPTIONS(self) -> None:  # noqa: N802
        if self.path.startswith("/api/"):
            self.send_response(204)
            self._cors()
            self.end_headers()
            return
        self.send_error(404)

    def _relayer(self, methode: str) -> None:
        longueur = int(self.headers.get("Content-Length") or 0)
        corps = self.rfile.read(longueur) if longueur else None
        requete = urllib.request.Request(
            API_PRODUCTION + self.path,
            data=corps,
            headers={"Content-Type": "application/json"},
            method=methode,
        )
        code = 502
        donnees = b'{"detail":"proxy indisponible"}'
        try:
            with urllib.request.urlopen(requete, timeout=90) as reponse:
                code = reponse.status
                donnees = reponse.read()
        except urllib.error.HTTPError as erreur:
            code = erreur.code
            donnees = erreur.read()
        except Exception:
            pass
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.send_header("Content-Length", str(len(donnees)))
        self.end_headers()
        self.wfile.write(donnees)

    def do_POST(self) -> None:  # noqa: N802
        if self.path.startswith("/api/"):
            self._relayer("POST")
            return
        self.send_error(404)

    def do_GET(self) -> None:  # noqa: N802
        if self.path.startswith("/api/"):
            self._relayer("GET")
            return
        super().do_GET()


def demarrer_serveur() -> socketserver.ThreadingTCPServer:
    handler = functools.partial(ServeurSilencieux, directory=str(DEPOT))
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    serveur = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    return serveur


def contexte(browser: Browser, largeur: int, hauteur: int, echelle: int) -> BrowserContext:
    return browser.new_context(
        viewport={"width": largeur, "height": hauteur},
        device_scale_factor=echelle,
        locale="fr-FR",
        color_scheme="light",
        is_mobile=True,
        has_touch=True,
    )


def ouvrir(ctx: BrowserContext, route: str = "#/") -> Page:
    page = ctx.new_page()
    page.goto(
        f"{BASE}/dist/index.html?app=1&theme=light&viewport=mobile&apiUrl={BASE}{route}",
        wait_until="load",
    )
    page.wait_for_timeout(2200)
    return page


def capturer(page: Page, chemin: Path) -> None:
    page.screenshot(path=str(chemin))
    with Image.open(chemin) as im:
        print(f"    · {chemin.name} {im.size[0]}×{im.size[1]}")


def suite_captures(browser: Browser, largeur: int, hauteur: int, echelle: int,
                   prefixe: str, dossier: Path) -> None:
    """Les quatre écrans d'une fiche, à une échelle donnée."""
    ctx = contexte(browser, largeur, hauteur, echelle)

    # 1. Accueil — ce que Mia sait faire
    page = ouvrir(ctx)
    capturer(page, dossier / f"{prefixe}-1-accueil.png")
    page.close()

    # 2. Conversation réelle : on pose une question, Mia répond
    page = ouvrir(ctx, "#/conversation")
    page.fill(".ep-input", MESSAGE)
    page.keyboard.press("Enter")
    try:
        # On attend la RÉPONSE, pas le message d'accueil : la bulle d'accueil est
        # déjà là. On compte donc les bulles d'agent hors indicateur de frappe.
        page.wait_for_function(
            "() => document.querySelectorAll('.ep-bubble--agent:not(.ep-typing)').length >= 2",
            timeout=90_000,
        )
        page.wait_for_timeout(1500)
    except Exception as erreur:  # réseau indisponible : on garde l'écran tel quel
        print(f"    ! réponse non reçue ({erreur.__class__.__name__}) — capture de l'état courant")
    capturer(page, dossier / f"{prefixe}-2-conversation.png")
    page.close()

    # 3. Aide — les neuf capacités et les collections
    page = ouvrir(ctx, "#/aide")
    capturer(page, dossier / f"{prefixe}-3-aide.png")
    page.close()

    # 4. Actualités — le blog dans l'application
    page = ouvrir(ctx, "#/actualites")
    capturer(page, dossier / f"{prefixe}-4-actualites.png")
    page.close()

    ctx.close()


def graphique_presentation(browser: Browser) -> None:
    """Graphique de présentation Play — 1024×500, sans transparence."""
    ctx = browser.new_context(viewport={"width": 1024, "height": 500}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto(f"{BASE}/docs/phase3-tache-6-4/stores/_gabarit-play.html", wait_until="load")
    page.wait_for_timeout(1200)
    chemin = PLAY / "graphique-1024x500.png"
    page.screenshot(path=str(chemin))
    with Image.open(chemin) as im:
        if im.mode in ("RGBA", "LA", "P"):
            im.convert("RGB").save(chemin)
    print(f"    · {chemin.name} 1024×500")
    ctx.close()


def icone_app_store() -> None:
    """Icône App Store 1024×1024, sans canal alpha (exigence Apple)."""
    source = Image.open(DEPOT / "public" / "icons" / "mia-512.png").convert("RGB")
    icone = source.resize((1024, 1024), Image.Resampling.LANCZOS)
    icone.save(APP_STORE / "icone-1024.png", optimize=True)
    print("    · icone-1024.png 1024×1024")


def main() -> None:
    PLAY.mkdir(parents=True, exist_ok=True)
    APP_STORE.mkdir(parents=True, exist_ok=True)

    # Icône Play : la même que l'application installée, à la taille exigée
    Image.open(DEPOT / "public" / "icons" / "mia-512.png").convert("RGB").save(
        PLAY / "icone-512.png", optimize=True
    )
    print("  Google Play")
    print("    · icone-512.png 512×512")

    serveur = demarrer_serveur()
    try:
        with sync_playwright() as p:
            navigateur = p.chromium.launch()
            graphique_presentation(navigateur)
            suite_captures(navigateur, 360, 640, 3, "telephone-1080x1920", PLAY)
            suite_captures(navigateur, 600, 960, 2, "tablette-7-1200x1920", PLAY)
            suite_captures(navigateur, 800, 1280, 2, "tablette-10-1600x2560", PLAY)
            print("  App Store")
            icone_app_store()
            suite_captures(navigateur, 440, 956, 3, "6-9-1320x2868", APP_STORE)
            navigateur.close()
    finally:
        serveur.shutdown()


if __name__ == "__main__":
    main()
