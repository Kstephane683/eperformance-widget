#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comparaison côte à côte des mêmes composants, dans les différents contextes
(tâche 6.9, point 5).

Ce script ne regarde pas des captures d'écran « à l'œil » : il lit les valeurs
RÉELLES calculées par le moteur de rendu (`getComputedStyle`) de chaque
composant, dans chaque contexte, et les compare propriété par propriété. La
planche côte à côte sert à voir ; le tableau sert à prouver.

Trois contextes :

  · widget       — le document du widget (mode application) ;
  · console      — la console d'administration, module Tableau de bord ;
  · pages        — la page publique /application/mia.

Quatre rôles comparés :

  · bouton d'accent (action principale) ;
  · carte (surface posée) ;
  · champ de saisie ;
  · état actif (sélection courante).

Un rôle absent d'un contexte est déclaré ABSENT, jamais inventé : les pages
publiques n'ont pas de champ de saisie, et le tableau le dit.

    python3 composants.py

Écrit uniquement dans `docs/phase3-tache-6-9/`.
"""

from __future__ import annotations

import functools
import hashlib
import http.server
import json
import re
import socketserver
import threading
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import Browser, sync_playwright

DEPOT = Path(__file__).resolve().parents[2]
DOSSIER = Path(__file__).resolve().parent
SORTIE = DOSSIER / "composants"
PORT = 8108
BASE = f"http://127.0.0.1:{PORT}"

API_PRODUCTION = "https://web-production-4ab53.up.railway.app"
MOTIF_API = re.compile(r"^https://web-production-4ab53\.up\.railway\.app/.*")

JETON = (
    "eyJhbGciOiJIUzI1NiJ9."
    "eyJlbWFpbCI6InN0ZXBoYW5lQGVwZXJmb3JtYW5jZS5wcm8iLCJub20iOiJTdMOpcGhhbmUgQmFsbG8iLCJyb2xlIjoiYWRtaW4ifQ."
    "c2lnbmF0dXJl"
)

ECHELLE = 2

# --------------------------------------------------------------------------
# Contexte × rôle
# --------------------------------------------------------------------------

CONTEXTES = {
    "widget": {
        "libelle": "Widget / application Mia",
        "url": "/dist/index.html?app=1&theme=light#/{route}",
        "amorce": ["  window.localStorage.setItem('eperf_conversation_id', 'conv_9f31ac02');"],
        "roles": {
            "bouton-accent": {"route": "conversation", "selecteur": ".ep-send"},
            # Le widget n'a PAS de bouton secondaire étiqueté : ses actions
            # secondaires sont des icônes sans filet dans la barre de saisie
            # (pièce jointe, emoji, dictée), et ses réponses rapides n'existent
            # qu'après une réponse de Mia, pas sur un fil repris du serveur.
            # Le rôle est donc déclaré ABSENT ici plutôt que comparé de travers.
            "bouton-secondaire": None,
            "carte": {"route": "", "selecteur": ".ep-suggestion"},
            "champ": {"route": "conversation", "selecteur": ".ep-input"},
            "etat-actif": {"route": "", "selecteur": ".ep-tab--actif"},
        },
    },
    "console": {
        "libelle": "Console d'administration",
        "url": "/dist/admin.html#/{route}",
        "amorce": ["  window.localStorage.setItem('eperf-theme', 'light');",
                   f"  window.localStorage.setItem('eperf_admin_token', '{JETON}');"],
        "roles": {
            # Le bouton d'accent et le champ de saisie n'existent que dans le
            # détail d'une conversation : on ouvre le premier fil, comme le
            # ferait un opérateur.
            "bouton-accent": {"route": "conversations", "selecteur": ".adm-btn--or",
                              "preparation": ".adm-boite__item"},
            "bouton-secondaire": {"route": "conversations", "selecteur": ".adm-btn--discret",
                                  "preparation": ".adm-boite__item"},
            "carte": {"route": "tableau-de-bord", "selecteur": ".adm-kpi"},
            # Le champ de rédaction n'apparaît que sur une conversation prise
            # en main par un conseiller : le deuxième fil des jeux d'essai est
            # dans cet état (human_active = true), le premier non.
            "champ": {"route": "conversations", "selecteur": ".adm-champ.adm-boite__texte",
                      "preparation": ".adm-boite__item", "preparation_index": 1},
            "etat-actif": {"route": "tableau-de-bord", "selecteur": ".adm-lien--actif"},
        },
    },
    "pages": {
        "libelle": "Pages publiques /application/mia",
        "url": "/dist/application/mia/index.html",
        "amorce": [],
        "roles": {
            "bouton-accent": {"route": "", "selecteur": ".btn-gold"},
            "bouton-secondaire": {"route": "", "selecteur": ".btn-outline"},
            "carte": {"route": "", "selecteur": ".card"},
            # Les pages publiques n'ont ni champ de saisie ni état actif : deux
            # lignes du tableau resteront vides, et c'est un RÉSULTAT, pas un
            # oubli de mesure.
            "champ": None,
            "etat-actif": None,
        },
    },
}

# Deux familles de propriétés, deux verdicts différents.
#
#   · SYSTÈME — la valeur vient d'un jeton : rayon, couleur, filet, ombre,
#     durée et courbe de transition, famille de police. Une différence ici est
#     une DIVERGENCE : deux écrans devraient parler la même langue.
#   · MÉTIER — la valeur dépend du rôle du composant : remplissage, corps de
#     texte, hauteur minimale. Un bouton de 40 px dans une console dense et un
#     bouton de 54 px sur une page de vente ont raison tous les deux. Ces
#     différences sont MESURÉES et comptées à part — jamais présentées comme
#     des défauts.
PROPRIETES_SYSTEME = [
    "border-top-left-radius", "background-color", "color", "border-top-color",
    "border-top-width", "border-top-style", "box-shadow", "font-family",
    "transition-duration", "transition-timing-function",
]
PROPRIETES_METIER = [
    "padding-top", "padding-right", "font-size", "font-weight", "gap",
    "min-height", "letter-spacing", "line-height",
]
PROPRIETES = PROPRIETES_SYSTEME + PROPRIETES_METIER

# Propriétés du système dont la valeur est INTRINSÈQUEMENT liée à la forme du
# composant : un rayon exprimé `50%` sur un carré et `999px` sur un bouton
# allongé donnent le MÊME arrondi complet. Les traiter comme divergentes
# reviendrait à compter deux écritures d'une même chose.
PROPRIETES_A_NUANCER = {"border-top-left-radius"}

MESURE_JS = """([selecteur, proprietes]) => {
  const el = document.querySelector(selecteur)
  if (!el) return null
  const s = getComputedStyle(el)
  const style = {}
  for (const p of proprietes) style[p] = s.getPropertyValue(p)
  const r = el.getBoundingClientRect()
  return { style, boite: { w: Math.round(r.width), h: Math.round(r.height) } }
}"""


class Serveur(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):  # type: ignore[override]
        pass


def demarrer_serveur() -> socketserver.ThreadingTCPServer:
    handler = functools.partial(Serveur, directory=str(DEPOT))
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    serveur = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    return serveur


def installer_api(page) -> None:
    """La console a besoin de données : on lui sert les jeux d'essai de 6.6."""
    jeux = json.loads((DOSSIER.parent / "phase3-tache-6-6" / "jeux-essai.json")
                      .read_text(encoding="utf-8"))

    def traiter(route) -> None:
        chemin = route.request.url.replace(API_PRODUCTION, "")
        donnees = {"detail": "non simulé"}
        code = 404
        if "/admin/stats" in chemin:
            donnees, code = jeux["stats"], 200
        elif re.search(r"/admin/conversations/[^/?]+$", chemin):
            # Le détail suit l'état du fil demandé : le deuxième des jeux
            # d'essai est pris en main par un conseiller (human_active = true),
            # et c'est le seul état où le champ de rédaction existe. Servir le
            # même détail à tous les fils rendait ce champ introuvable.
            detail = json.loads(json.dumps(jeux["detail"]))
            if "conv_7c04b1de" in chemin:
                detail["conversation"]["human_active"] = True
                detail["conversation"]["status"] = "escalated"
                detail["lead"] = {"name": "Ibrahim Koné", "email": None,
                                  "phone": "+225 07 45 12 88 03"}
            donnees, code = detail, 200
        elif "/admin/conversations" in chemin:
            donnees, code = {"conversations": jeux["conversations"],
                             "total": len(jeux["conversations"])}, 200
        elif "/admin/users" in chemin:
            donnees, code = {"users": jeux["utilisateurs"],
                             "total": len(jeux["utilisateurs"])}, 200
        elif "/admin/candidats" in chemin:
            donnees, code = {"candidats": jeux["candidats"],
                             "total": len(jeux["candidats"])}, 200
        elif re.search(r"/api/chatbot/conversation/[^/?]+$", chemin):
            donnees, code = {"conversation_id": "conv_9f31ac02",
                             "site_id": "eperformance_vitrine", "status": "active",
                             "created_at": None, "updated_at": None, "messages": []}, 200
        route.fulfill(status=code, content_type="application/json",
                      body=json.dumps(donnees, ensure_ascii=False))

    page.route(MOTIF_API, traiter)


def mesurer(browser: Browser) -> dict:
    resultats: dict[str, dict] = {}
    for nom_contexte, contexte in CONTEXTES.items():
        resultats[nom_contexte] = {"libelle": contexte["libelle"], "roles": {}}
        print(f"Contexte « {contexte['libelle']} »")
        with browser.new_context(viewport={"width": 1440, "height": 900},
                                 device_scale_factor=ECHELLE, locale="fr-FR",
                                 color_scheme="light") as ctx:
            if contexte["amorce"]:
                ctx.add_init_script("\n".join(["try {", *contexte["amorce"], "} catch (e) {}"]))
            for nom_role, cible in contexte["roles"].items():
                if cible is None:
                    resultats[nom_contexte]["roles"][nom_role] = {
                        "absent": True,
                        "raison": "ce contexte ne porte pas ce rôle",
                    }
                    print(f"  · {nom_role:16s} absent")
                    continue
                page = ctx.new_page()
                installer_api(page)
                page.goto(f"{BASE}{contexte['url'].replace('{route}', cible['route'])}",
                          wait_until="load")
                try:
                    if cible.get("preparation"):
                        page.wait_for_selector(cible["preparation"], timeout=25_000)
                        page.locator(cible["preparation"]).nth(
                            cible.get("preparation_index", 0)).click()
                    page.wait_for_selector(cible["selecteur"], timeout=25_000)
                except Exception:  # noqa: BLE001
                    resultats[nom_contexte]["roles"][nom_role] = {
                        "absent": True,
                        "raison": f"sélecteur {cible['selecteur']} introuvable",
                    }
                    print(f"  · {nom_role:16s} introuvable")
                    page.close()
                    continue
                page.wait_for_timeout(700)
                donnees = page.evaluate(MESURE_JS, [cible["selecteur"], PROPRIETES])
                # Capture du composant seul, sur son fond réel. On l'amène
                # d'abord dans la fenêtre : un composant plus bas que le pli
                # donnerait un rectangle de capture hors de l'image.
                element = page.locator(cible["selecteur"]).first
                element.scroll_into_view_if_needed()
                page.wait_for_timeout(250)
                boite = element.bounding_box()
                fichier = SORTIE / f"{nom_contexte}-{nom_role}.png"
                if boite:
                    marge = 10
                    page.screenshot(path=str(fichier), animations="disabled", clip={
                        "x": max(boite["x"] - marge, 0), "y": max(boite["y"] - marge, 0),
                        "width": min(boite["width"] + 2 * marge, 1400),
                        "height": min(boite["height"] + 2 * marge, 860)})
                donnees["image"] = fichier.name
                donnees["md5"] = hashlib.md5(fichier.read_bytes()).hexdigest() if fichier.is_file() else None
                donnees["selecteur"] = cible["selecteur"]
                resultats[nom_contexte]["roles"][nom_role] = donnees
                print(f"  · {nom_role:16s} {cible['selecteur']:24s} "
                      f"rayon={donnees['style']['border-top-left-radius']} "
                      f"fond={donnees['style']['background-color']}")
                page.close()
    return resultats


def normaliser(propriete: str, valeur: str) -> str:
    """Réduit une valeur à son EFFET, pas à son écriture.

    `transition-duration` liste une durée par propriété animée : `0.3s, 0.15s`
    et `0.3s, 0.3s, 0.3s, 0.15s` ne disent pas deux choses différentes, elles
    disent le même couple de durées appliqué à plus de propriétés. Comparer les
    chaînes ferait apparaître une divergence là où deux composants partagent
    exactement la même durée et la même courbe.
    """
    if propriete in ("transition-duration", "transition-timing-function"):
        morceaux = [m.strip() for m in (valeur or "").split(",") if m.strip()]
        return " | ".join(sorted(set(morceaux)))[:120]
    return (valeur or "").strip()


def meme_effet_arrondi(valeurs: dict[str, str]) -> bool:
    """Les rayons valent-ils tous « complètement arrondi » ?

    `50%` sur un carré, `999px` sur un bouton allongé : deux écritures, un seul
    effet. On compare l'EFFET, pas la chaîne.
    """
    for valeur in valeurs.values():
        valeur = (valeur or "").strip()
        if valeur.endswith("%"):
            continue
        try:
            if float(valeur[:-2]) >= 40:
                continue
        except ValueError:
            return False
        return False
    return True


def comparer(resultats: dict) -> dict:
    """Confronte les valeurs réellement calculées, propriété par propriété."""
    comparaison: dict[str, dict] = {}
    for nom_role in CONTEXTES["widget"]["roles"]:
        valeurs: dict[str, dict] = {}
        for nom_contexte, bloc in resultats.items():
            role = bloc["roles"].get(nom_role)
            if role and not role.get("absent"):
                valeurs[nom_contexte] = role["style"]
        if len(valeurs) < 2:
            comparaison[nom_role] = {"contextes_presents": sorted(valeurs),
                                     "proprietes_comparees": 0, "divergences": []}
            continue
        divergences, differences_metier = [], []
        for propriete in PROPRIETES:
            distinctes = {ctx: normaliser(propriete, style.get(propriete))
                          for ctx, style in valeurs.items()}
            if len(set(distinctes.values())) <= 1:
                continue
            if (propriete in PROPRIETES_A_NUANCER
                    and meme_effet_arrondi(distinctes)):
                continue
            (divergences if propriete in PROPRIETES_SYSTEME
             else differences_metier).append({"propriete": propriete, "valeurs": distinctes})
        comparaison[nom_role] = {
            "contextes_presents": sorted(valeurs),
            "proprietes_systeme_comparees": len(PROPRIETES_SYSTEME),
            "proprietes_metier_comparees": len(PROPRIETES_METIER),
            "divergences": divergences,
            "nombre_divergences": len(divergences),
            "differences_de_metier": differences_metier,
            "nombre_differences_de_metier": len(differences_metier),
        }
    return comparaison


def planche(resultats: dict, comparaison: dict) -> Path:
    """Planche côte à côte : une ligne par rôle, une colonne par contexte."""
    contextes = list(CONTEXTES)
    roles = list(CONTEXTES["widget"]["roles"])
    largeur, hauteur = 420, 190
    en_tete, etiquette, marge = 150, 74, 28
    image = Image.new(
        "RGB",
        (marge * 2 + len(contextes) * (largeur + 18),
         en_tete + len(roles) * (hauteur + etiquette) + marge),
        (253, 252, 250))
    dessin = ImageDraw.Draw(image)
    dessin.text((marge, 22), "Tâche 6.9 — mêmes composants, contextes différents "
                             "(valeurs calculées, échelle 2)", fill=(22, 21, 26))
    dessin.text((marge, 44), "Une divergence est une différence sur une propriété "
                             "que le design system gouverne.", fill=(106, 103, 111))
    for colonne, nom_contexte in enumerate(contextes):
        x = marge + colonne * (largeur + 18)
        dessin.text((x, en_tete - 22), f"{nom_contexte} — "
                                       f"{CONTEXTES[nom_contexte]['libelle'][:44]}",
                    fill=(22, 21, 26))
    for ligne, nom_role in enumerate(roles):
        y = en_tete + ligne * (hauteur + etiquette)
        dessin.text((marge, y - 20), f"{nom_role}", fill=(22, 21, 26))
        for colonne, nom_contexte in enumerate(contextes):
            x = marge + colonne * (largeur + 18)
            role = resultats[nom_contexte]["roles"].get(nom_role)
            if not role or role.get("absent"):
                dessin.rectangle([x, y, x + largeur, y + hauteur], outline=(213, 207, 195))
                dessin.text((x + 10, y + hauteur // 2), "absent dans ce contexte",
                            fill=(106, 103, 111))
                continue
            chemin = SORTIE / role["image"]
            if not chemin.is_file():
                continue
            vignette = Image.open(chemin).convert("RGB")
            vignette.thumbnail((largeur, hauteur))
            image.paste(vignette, (x, y))
            style = role["style"]
            lignes = [
                f"rayon {style['border-top-left-radius']}  ·  "
                f"police {style['font-size']} / {style['font-weight']}",
                f"fond {style['background-color']}",
                f"filet {style['border-top-width']} {style['border-top-color']}",
                f"padding {style['padding-top']} / {style['padding-right']}",
            ]
            for i, texte in enumerate(lignes):
                dessin.text((x, y + vignette.height + 4 + i * 14), texte[:64],
                            fill=(106, 103, 111))
    chemin = DOSSIER / "composants-cote-a-cote.png"
    image.save(chemin)
    return chemin


def main() -> int:
    SORTIE.mkdir(parents=True, exist_ok=True)
    serveur = demarrer_serveur()
    try:
        with sync_playwright() as p:
            navigateur = p.chromium.launch()
            resultats = mesurer(navigateur)
            navigateur.close()
        comparaison = comparer(resultats)
        (DOSSIER / "mesures-composants.json").write_text(
            json.dumps({"proprietes_systeme": PROPRIETES_SYSTEME,
                        "proprietes_metier": PROPRIETES_METIER,
                        "proprietes_a_nuancer": sorted(PROPRIETES_A_NUANCER),
                        "contextes": resultats, "comparaison": comparaison},
                       ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("\nComparaison, propriété par propriété :")
        for nom_role, bloc in comparaison.items():
            print(f"  {nom_role:18s} {len(bloc['contextes_presents'])} contexte(s) · "
                  f"{bloc.get('nombre_divergences', 0)} divergence(s) de design system · "
                  f"{bloc.get('nombre_differences_de_metier', 0)} différence(s) de métier")
            for divergence in bloc["divergences"]:
                print(f"      D.SYS  {divergence['propriete']} : {divergence['valeurs']}")
            for difference in bloc.get("differences_de_metier", []):
                print(f"      métier {difference['propriete']} : {difference['valeurs']}")
        chemin = planche(resultats, comparaison)
        print(f"\n  planche : {chemin.name}")
    finally:
        serveur.shutdown()
        try:
            serveur.server_close()
        except OSError:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
