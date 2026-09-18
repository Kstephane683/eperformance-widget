#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mesure Lighthouse des pages livrées par la tâche 6.4.

Cibles :
  · l'application Mia (`/index.html?app=1`) — installabilité, service worker ;
  · la page de présentation (`/application/mia/`) — objectif
    accessibilité / bonnes pratiques / SEO ≥ 95, performance ≥ 90 ;
  · le portail (`/application/`) — même exigence.

Deux versions de Lighthouse sont lancées, et c'est volontaire :
  · **Lighthouse 11** : dernière version qui porte la catégorie **PWA**. Sans
    elle, « PWA ≥ 95 » n'est pas mesurable — la catégorie a été retirée en
    Lighthouse 12 au motif que Chrome ne l'expose plus comme un score ;
  · **Lighthouse 13** (courante) : accessibilité, bonnes pratiques, SEO et
    performance avec les audits à jour.
Les deux rapports sont conservés en JSON et en HTML dans `lighthouse/`.

Le serveur local sert `dist/` avec les types MIME exacts attendus
(`application/manifest+json` pour le manifeste, `text/javascript` pour le
service worker) : un type incorrect ferait échouer l'installabilité et
fausserait la mesure.

    python3 lighthouse.py            # tout
    python3 lighthouse.py 11         # une seule version
"""

from __future__ import annotations

import functools
import http.server
import json
import os
import socketserver
import subprocess
import sys
import threading
from pathlib import Path

DEPOT = Path(__file__).resolve().parents[2]
DIST = DEPOT / "dist"
DOSSIER = Path(__file__).resolve().parent / "lighthouse"
PORT = 8110
BASE = f"http://127.0.0.1:{PORT}"

CIBLES = [
    ("application", "/index.html?app=1&theme=light&viewport=mobile"),
    ("page-mia", "/application/mia/"),
    ("portail", "/application/"),
]

# Chromium de Playwright : évite de dépendre d'un Chrome système
CHROMIUM = sorted(Path.home().glob(".cache/ms-playwright/chromium-*/chrome-linux/chrome"))
CHROME_PATH = str(CHROMIUM[-1]) if CHROMIUM else None


class ServeurTypes(http.server.SimpleHTTPRequestHandler):
    """Types MIME exacts pour le manifeste et le service worker."""

    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".webmanifest": "application/manifest+json",
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".woff2": "font/woff2",
        ".svg": "image/svg+xml",
        ".html": "text/html",
        ".png": "image/png",
        ".webp": "image/webp",
    }

    def log_message(self, *args):  # type: ignore[override]
        pass

    # NOTE : ce serveur ne compresse pas (le module http.server ne le fait pas).
    # Les scores mesurés ici sont donc PESSIMISTES par rapport à GitHub Pages,
    # qui sert gzip. La mesure de référence est celle de la production
    # (voir RAPPORT-6-4-BLOC-B.md §3.2) : mêmes audits, mêmes gabarits.


def demarrer_serveur() -> socketserver.ThreadingTCPServer:
    handler = functools.partial(ServeurTypes, directory=str(DIST))
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    serveur = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    return serveur


def lancer_lighthouse(version: int, nom: str, chemin: str) -> dict:
    base = f"{DOSSIER}/lh{version}-{nom}"
    commande = [
        "npx",
        "--yes",
        f"lighthouse@{version}",
        f"{BASE}{chemin}",
        "--quiet",
        "--output=json,html",
        f"--output-path={base}",
        "--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage",
        "--preset=desktop" if nom == "portail-desktop" else "--form-factor=mobile",
    ]
    if CHROME_PATH:
        commande.append(f"--chrome-path={CHROME_PATH}")
    print(f"  → lighthouse@{version} {nom} …", flush=True)
    resultat = subprocess.run(
        commande, capture_output=True, text=True, env={**os.environ, "CHROME_PATH": CHROME_PATH or ""}
    )
    if resultat.returncode != 0:
        print(f"    ! échec ({resultat.returncode}) : {resultat.stderr[-600:]}")
        return {}
    rapport = json.loads(Path(f"{base}.report.json").read_text(encoding="utf-8"))
    scores = {
        categorie: round((donnees.get("score") or 0) * 100)
        for categorie, donnees in rapport.get("categories", {}).items()
    }
    print(f"    {nom} : " + " · ".join(f"{c}={s}" for c, s in scores.items()))
    return scores


def main() -> None:
    DOSSIER.mkdir(parents=True, exist_ok=True)
    versions = [int(sys.argv[1])] if len(sys.argv) > 1 else [11, 13]
    serveur = demarrer_serveur()
    resultats: dict = {}
    try:
        for version in versions:
            print(f"Lighthouse {version}" + (f" (Chromium {CHROME_PATH})" if CHROME_PATH else ""))
            for nom, chemin in CIBLES:
                resultats[f"lh{version}-{nom}"] = lancer_lighthouse(version, nom, chemin)
            # Une passe desktop sur la page de présentation : la mise en page
            # est aussi jugée sur grand écran.
            resultats[f"lh{version}-page-mia-desktop"] = lancer_lighthouse(
                version, "portail-desktop", "/application/mia/"
            )
    finally:
        serveur.shutdown()
    (DOSSIER / "scores.json").write_text(
        json.dumps(resultats, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"→ {DOSSIER / 'scores.json'}")


if __name__ == "__main__":
    main()
