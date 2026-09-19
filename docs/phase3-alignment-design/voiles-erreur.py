#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Captures des VOILES D'ERREUR — décision D7a.

Le harnais de composants de 6.9 mesure cinq rôles, dont aucun ne porte de voile
d'erreur : celui-ci n'apparaît que sur une requête qui échoue. Il faut donc
provoquer l'échec pour photographier le composant.

Deux endroits du produit portent ce voile, et ce sont les deux seuls :

  · `.adm-erreur`, le message d'échec d'un module de la console. On le fait
    apparaître en laissant l'API répondre 500 sur `/admin/stats` — c'est le
    serveur qui parle, pas une maquette ;
  · `.ep-login__error`, le refus de connexion. On le fait apparaître en
    laissant `/api/auth/login` répondre 401, comme le ferait un mot de passe
    faux.

Le serveur, le jeton et la simulation d'API viennent du harnais de 6.9 ; ce
script n'ajoute QUE la panne, et rien d'autre.

    python3 voiles-erreur.py avant
    python3 voiles-erreur.py apres
"""

from __future__ import annotations

import importlib.util
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

DOSSIER = Path(__file__).resolve().parent
DEPOT = DOSSIER.parents[1]
HARNAIS_69 = DEPOT / "docs" / "phase3-tache-6-9" / "composants.py"

_spec = importlib.util.spec_from_file_location("composants_69", HARNAIS_69)
harnais = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(harnais)

# (thème, cible, description) — le sélecteur est celui du composant qui porte
# le voile, pas celui de la page.
CIBLES = [
    ("light", "console-adm-erreur", ".adm-erreur"),
    ("dark", "console-adm-erreur", ".adm-erreur"),
    ("light", "console-login-erreur", ".ep-login__error"),
    ("dark", "console-login-erreur", ".ep-login__error"),
]

# Ce qui doit échouer pour que le composant existe. Le motif est évalué sur
# l'URL et rend un code d'erreur ; `None` laisse le harnais répondre.
PANNES = {
    "console-adm-erreur": (r"/admin/stats", 500),
    "console-login-erreur": (r"/api/auth/login", 401),
}

ROUTE_MODULE = {"console-adm-erreur": "tableau-de-bord", "console-login-erreur": ""}


def capturer(nom: str) -> Path:
    sortie = DOSSIER / f"voiles-{nom}"
    sortie.mkdir(parents=True, exist_ok=True)
    resultats: dict[str, dict] = {}
    serveur = harnais.demarrer_serveur()
    try:
        with sync_playwright() as p:
            navigateur = p.chromium.launch()
            for theme, cible, selecteur in CIBLES:
                nom_fichier = f"{cible}-{theme}"
                est_login = cible == "console-login-erreur"
                contexte = navigateur.new_context(
                    viewport={"width": 1440, "height": 900}, locale="fr-FR",
                    color_scheme=theme)
                contexte.add_init_script(
                    "\n".join([
                        "try {",
                        f"  window.localStorage.setItem('eperf-theme', '{theme}');",
                        # La route de connexion n'existe que SANS jeton : poser
                        # le jeton renverrait sur le tableau de bord, et le
                        # composant à photographier ne serait jamais monté.
                        "" if est_login else
                        f"  window.localStorage.setItem('eperf_admin_token', '{harnais.JETON}');",
                        "} catch (e) {}",
                    ]))
                page = contexte.new_page()
                harnais.installer_api(page)

                # Posé APRÈS `installer_api` : Playwright applique les routes
                # les plus récentes d'abord, donc celle-ci prend la main sur le
                # seul motif qui doit échouer et laisse le harnais servir le
                # reste — y compris le 404 de ses routes non simulées.
                motif, code = PANNES[cible]

                def panne(route, *_args, motif=motif, code=code):  # noqa: ANN002, ANN001
                    # Playwright appelle le gestionnaire `(route, requête)` :
                    # les valeurs par défaut sont donc capturées par mot-clé,
                    # pas par position.
                    if re.search(motif, route.request.url):
                        route.fulfill(status=code, content_type="application/json",
                                      body=json.dumps({"detail": "panne simulée"}))
                    else:
                        route.fallback()

                page.route(harnais.MOTIF_API, panne)

                url = f"{harnais.BASE}/dist/admin.html#/{ROUTE_MODULE[cible]}"
                page.goto(url, wait_until="load")
                try:
                    if est_login:
                        # Le refus se produit en soumettant le formulaire :
                        # c'est le chemin réel, pas un état injecté.
                        page.wait_for_selector(".ep-login__submit", timeout=25_000)
                        page.fill("#ep-login-email", "stephane@eperformance.pro")
                        page.fill("#ep-login-password", "mot-de-passe-faux")
                        page.click(".ep-login__submit")
                    page.wait_for_selector(selecteur, timeout=25_000)
                    page.wait_for_function(
                        "() => document.fonts.status === 'loaded'", timeout=10_000)
                    page.wait_for_timeout(700)
                except Exception:  # noqa: BLE001
                    print(f"  ! {nom_fichier} : {selecteur} introuvable")
                    page.close()
                    contexte.close()
                    continue

                element = page.locator(selecteur).first
                element.scroll_into_view_if_needed()
                page.wait_for_timeout(250)
                boite = element.bounding_box()
                fichier = sortie / f"{nom_fichier}.png"
                if boite:
                    marge = 12
                    page.screenshot(path=str(fichier), animations="disabled", clip={
                        "x": max(boite["x"] - marge, 0), "y": max(boite["y"] - marge, 0),
                        "width": min(boite["width"] + 2 * marge, 1400),
                        "height": min(boite["height"] + 2 * marge, 860)})
                style = page.evaluate(
                    """(s) => { const e = document.querySelector(s)
                         if (!e) return null
                         const c = getComputedStyle(e)
                         return { 'background-color': c.backgroundColor,
                                  'border-top-color': c.borderTopColor,
                                  color: c.color,
                                  'border-top-left-radius': c.borderTopLeftRadius } }""",
                    selecteur)
                resultats[nom_fichier] = {"selecteur": selecteur, "theme": theme,
                                          "style": style, "image": fichier.name}
                print(f"  · {nom_fichier:28s} {selecteur:20s} "
                      f"fond={style['background-color']} filet={style['border-top-color']}")
                page.close()
                contexte.close()
            navigateur.close()
    finally:
        serveur.shutdown()
        try:
            serveur.server_close()
        except OSError:
            pass
    (DOSSIER / f"voiles-{nom}.json").write_text(
        json.dumps(resultats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return sortie


def main() -> int:
    nom = sys.argv[1] if len(sys.argv) > 1 else "avant"
    print(f"Captures des voiles d'erreur — état « {nom} »")
    sortie = capturer(nom)
    print(f"\n  écrit dans {sortie.relative_to(DEPOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
