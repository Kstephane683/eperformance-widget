#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Captures et mesures de la tâche 6.3-BIS (Bloc A) — avant / après.

Produit dans ce dossier les captures des corrections A.2, A.3, A.4, A.6, A.7,
A.8, A.9 en clair et en sombre, aux deux gabarits demandés (desktop 1280×720,
mobile 390×844), pour le build AVANT (`dist-avant/`, commit 78ea5b8) et le
build APRÈS (`dist/`).

Il sert aussi les mesures qui prouvent les corrections de défilement :
  · `mesures-defilement.json` : pour chaque écran et chaque build, la hauteur
    de contenu (`scrollHeight`) contre la hauteur visible (`clientHeight`) et
    la position de défilement maximale atteinte.

LIMITE ASSUMÉE : les émulateurs Android/iOS ne sont pas installés sur cette
machine (SDK Android absent ; iOS exige macOS/Xcode). La validation se fait par
émulation de viewport dans un vrai moteur de rendu (Chromium via Playwright),
ce qui couvre la mise en page CSS et le défilement — mais PAS les
comportements propres à un appareil (clavier iOS, safe-area réelles, Web
Speech API mobile).

    python3 captures.py
"""

from __future__ import annotations

import functools
import http.server
import json
import shutil
import socketserver
import threading
import time
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

DOSSIER = Path(__file__).resolve().parent
RACINE_WIDGET = DOSSIER.parents[1]
SERVEUR = Path("/tmp/ep-captures-63bis")
PORT = 8103
BASE = f"http://127.0.0.1:{PORT}"

CADRES = {"desktop": {"width": 1280, "height": 720}, "mobile": {"width": 390, "height": 844}}
THEMES = ("clair", "sombre")

# Le backend est simulé : les captures doivent être déterministes et ne
# dépendent pas de la disponibilité de Railway. Le contenu renvoyé reproduit
# exactement la forme du contrat V2.2 (texte seul, metadata complète).
REPONSE_SIMULEE = {
    "text": (
        "Bonne question. Avant de te répondre précisément, dis-moi ce qui te "
        "bloque le plus en ce moment : tu manques de contacts, ou tu en as "
        "mais ils n'achètent pas ?"
    ),
    "html": None,
    "files": None,
    "metadata": {
        "conversation_id": "conv_capture",
        "intent": "general_question",
        # Volontairement renseigné : c'est ce champ qui fuyait à l'écran (A.6)
        "agent_used": "sales-discovery-coach",
        "actions": [],
        "suggestions": ["Parler à un conseiller", "Faire un diagnostic"],
        "processing_time": 12,
        "human_active": False,
    },
}


# ---------------------------------------------------------------- serveur

def preparer_serveur() -> None:
    if SERVEUR.exists():
        shutil.rmtree(SERVEUR)
    SERVEUR.mkdir(parents=True)
    shutil.copytree(RACINE_WIDGET / "docs/phase3-tache-6-3-bis/dist-avant", SERVEUR / "avant")
    shutil.copytree(RACINE_WIDGET / "dist", SERVEUR / "apres")
    # Index du blog servi localement (production récupérée au préalable)
    index = Path("/tmp/chatbot-index.json")
    if index.exists():
        shutil.copy(index, SERVEUR / "chatbot-index.json")
    (SERVEUR / "hote.html").write_text(HOTE, encoding="utf-8")


HOTE = """<!doctype html>
<html lang="fr" data-theme="light">
<head>
<meta charset="utf-8">
<title>Hôte de capture</title>
<style>
  html, body { margin: 0; height: 100%; background: #ffffff; font-family: sans-serif; }
  iframe { width: 400px; height: 650px; border: 0; box-shadow: 0 12px 32px rgba(0,0,0,.18);
           position: absolute; right: 24px; bottom: 24px; }
  body.mobile iframe { width: 100%; height: 100%; right: 0; bottom: 0; box-shadow: none; }
</style>
</head>
<body>
<iframe id="w" title="Assistant ePerformance" allow="clipboard-write"></iframe>
<script>
  const params = new URLSearchParams(location.search);
  const build = params.get('build') || 'apres';
  const theme = params.get('theme') || 'light';
  const viewport = params.get('viewport') || 'desktop';
  document.documentElement.setAttribute('data-theme', theme);
  if (viewport === 'mobile') document.body.classList.add('mobile');
  const url = new URL(`/${build}/index.html`, location.origin);
  url.searchParams.set('apiUrl', location.origin);
  url.searchParams.set('siteId', 'eperformance_vitrine');
  url.searchParams.set('theme', theme);
  url.searchParams.set('viewport', viewport);
  url.searchParams.set('color', theme === 'dark' ? '#c9a96e' : '#856b37');
  url.searchParams.set('indexUrl', location.origin);
  document.getElementById('w').src = url.toString();
</script>
</body>
</html>
"""


def servir() -> socketserver.TCPServer:
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(SERVEUR))

    class Serveur(socketserver.TCPServer):
        allow_reuse_address = True

    httpd = Serveur(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


# ---------------------------------------------------------------- playwright

def ouvrir(page: Page, build: str, theme: str, viewport: str):
    page.goto(f"{BASE}/hote.html?build={build}&theme={theme}&viewport={viewport}")
    page.wait_for_selector("#w")
    time.sleep(0.6)
    return page.frame_locator("#w")


def capturer(page: Page, nom: str) -> None:
    page.screenshot(path=str(DOSSIER / f"{nom}.png"))


def onglet(frame, nom: str):
    frame.locator(f"#ep-tab-{nom}").click()
    time.sleep(0.45)


def aller_conversation(frame) -> None:
    frame.locator(".ep-saisie").click()
    time.sleep(0.45)


def envoyer(frame, texte: str) -> None:
    champ = frame.locator(".ep-input")
    champ.fill(texte)
    champ.press("Enter")
    time.sleep(1.0)


def mesures_defilement(page: Page, frame) -> dict:
    return page.evaluate(
        """() => {
            const doc = document.getElementById('w').contentDocument;
            const vue = doc.querySelector('.ep-vue');
            if (!vue) return null;
            return {
              scrollHeight: vue.scrollHeight,
              clientHeight: vue.clientHeight,
              defilable: vue.scrollHeight > vue.clientHeight + 1,
              overflowY: getComputedStyle(vue).overflowY,
            };
        }"""
    )


def defiler_en_bas(page: Page) -> None:
    page.evaluate(
        """() => {
            const doc = document.getElementById('w').contentDocument;
            const vue = doc.querySelector('.ep-vue');
            if (vue) vue.scrollTop = vue.scrollHeight;
        }"""
    )
    time.sleep(0.5)


def main() -> None:
    preparer_serveur()
    httpd = servir()
    mesures: dict = {}

    with sync_playwright() as p:
        navigateur = p.chromium.launch()
        for gabarit, taille in CADRES.items():
            for theme in THEMES:
                suffixe = f"{gabarit}-{theme}"
                for build in ("avant", "apres"):
                    contexte = navigateur.new_context(viewport=taille)
                    page = contexte.new_page()
                    page.route(
                        "**/api/chatbot/message",
                        lambda route: route.fulfill(
                            status=200,
                            content_type="application/json",
                            body=json.dumps(REPONSE_SIMULEE),
                        ),
                    )
                    page.route(
                        "**/api/chatbot/conversation/**",
                        lambda route: route.fulfill(status=404, body="{}"),
                    )
                    frame = ouvrir(page, build, "dark" if theme == "sombre" else "light", gabarit)

                    # --- Accueil (A.7, A.8) ---
                    capturer(page, f"A8-accueil-{build}-{suffixe}")
                    mesures[f"accueil-{build}-{suffixe}"] = mesures_defilement(page, frame)
                    defiler_en_bas(page)
                    capturer(page, f"A7-accueil-bas-{build}-{suffixe}")

                    # --- Actualités (A.2) ---
                    onglet(frame, "actualites")
                    capturer(page, f"A2-actualites-{build}-{suffixe}")
                    mesures[f"actualites-{build}-{suffixe}"] = mesures_defilement(page, frame)
                    defiler_en_bas(page)
                    capturer(page, f"A2-actualites-bas-{build}-{suffixe}")
                    frame.locator(".ep-vue").evaluate("el => el.scrollTop = 0")

                    # --- Aide (A.9) ---
                    onglet(frame, "aide")
                    capturer(page, f"A9-aide-{build}-{suffixe}")
                    mesures[f"aide-{build}-{suffixe}"] = mesures_defilement(page, frame)

                    # --- Conversation (A.3, A.4, A.6) ---
                    onglet(frame, "home")
                    aller_conversation(frame)
                    envoyer(frame, "Bonjour")
                    capturer(page, f"A3A4A6-conversation-{build}-{suffixe}")
                    mesures[f"conversation-{build}-{suffixe}"] = mesures_defilement(page, frame)

                    contexte.close()

        navigateur.close()

    httpd.shutdown()
    (DOSSIER / "mesures-defilement.json").write_text(
        json.dumps(mesures, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(json.dumps(mesures, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
