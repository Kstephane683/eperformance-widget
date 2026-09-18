#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Maquettes finales — tâche 6.6.

Produit les maquettes de référence de TOUS les écrans du produit, en clair et
en sombre, en mobile et en desktop, à l'échelle 2 (exigence de la consigne :
« facteur 2 au minimum »).

Ce script ne contient AUCUNE liste d'écrans : la liste, les gabarits, les
thèmes, l'échelle et les sélecteurs sont dans `maquettes.config.json`, versionné
à côté. Modifier une maquette = modifier la configuration ; régénérer les
images ne demande jamais de toucher au code.

    python3 captures.py                 # toutes les séries + index + planche
    python3 captures.py widget          # une série
    python3 captures.py console
    python3 captures.py application
    python3 captures.py pages
    python3 captures.py conversation-reelle   # API de production (hors maquettes)
    python3 captures.py index           # index et planche, sans recapturer

Les maquettes sont prises depuis l'APPLICATION RÉELLEMENT EXÉCUTÉE :

  · le build de `dist/` est servi tel quel par un serveur statique local — le
    même artefact que celui publié, aucune reconstitution ;
  · la console d'administration est alimentée par une API SIMULÉE
    (`jeux-essai.json`, repris de la tâche 6.3) : les images sont alors
    reproductibles à l'octet, ce qu'une API vivante ne permet pas ;
  · le widget visiteur est capturé DANS la page d'un site hôte réel
    (`harnais 6.4`), ouvert par le SDK, à sa largeur d'intégration ;
  · la série `conversation-reelle` relaie les appels vers l'API de PRODUCTION :
    Mia répond réellement, seule la transportée est locale (le backend
    n'autorise pas l'origine 127.0.0.1). Ces images ne sont pas des maquettes
    reproductibles : elles servent de preuve de bout en bout, et de base à la
    mesure des emoji de la tâche 6.9.

Aucun fichier n'est écrit hors de `docs/phase3-tache-6-6/`.
"""

from __future__ import annotations

import functools
import hashlib
import http.server
import json
import re
import socketserver
import sys
import threading
import urllib.error
import urllib.request
from pathlib import Path

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

DEPOT = Path(__file__).resolve().parents[2]  # …/eperformance-widget
DOSSIER = Path(__file__).resolve().parent
MAQUETTES = DOSSIER / "maquettes"
CONFIG = json.loads((DOSSIER / "maquettes.config.json").read_text(encoding="utf-8"))
JEUX = json.loads((DOSSIER / "jeux-essai.json").read_text(encoding="utf-8"))

PORT = 8107
BASE = f"http://127.0.0.1:{PORT}"

API_PRODUCTION = "https://web-production-4ab53.up.railway.app"
# Motif en EXPRESSION RÉGULIÈRE, et non en glob : dans un motif glob de
# Playwright, `*` ne franchit pas le séparateur `/` — `…railway.app/*` ne
# correspond donc PAS à `…railway.app/api/chatbot/admin/stats`. La route n'était
# pas interceptée, la requête partait sur le réseau réel et échouait en CORS :
# la capture montrait un tableau de bord vide sans que rien ne le signale.
# C'est le contrôle `appels_api` (voir plus bas) qui a rendu le défaut visible.
MOTIF_API = re.compile(r"^https://web-production-4ab53\.up\.railway\.app/.*")

ECHELLE = CONFIG["echelle"]
HORLOGE_FIGEE = CONFIG["horloge_figee"]
DELAIS = CONFIG["delais_ms"]
ENTREES = CONFIG["entrees"]
GABARITS = CONFIG["gabarits"]
THEMES = CONFIG["themes"]
TERMES_INTERNES = CONFIG["controles"]["termes_internes"]

# Jeton de la console — JWT factice dont la charge utile porte {email, nom, role}.
# Aucun secret : la signature n'est jamais vérifiée par le client, l'API est
# simulée. C'est la même amorce que le harnais de la tâche 6.3.
JETON = (
    "eyJhbGciOiJIUzI1NiJ9."
    "eyJlbWFpbCI6InN0ZXBoYW5lQGVwZXJmb3JtYW5jZS5wcm8iLCJub20iOiJTdMOpcGhhbmUgQmFsbG8iLCJyb2xlIjoiYWRtaW4ifQ."
    "c2lnbmF0dXJl"
)

HISTORIQUE = {
    "conversation_id": "conv_9f31ac02",
    "site_id": "eperformance_vitrine",
    "status": "active",
    "created_at": "2026-09-17T09:12:00Z",
    "updated_at": "2026-09-18T09:04:00Z",
    "messages": [
        {
            "role": "user",
            "content": "Bonjour, je vends des cosmétiques en ligne et je veux doubler mes commandes.",
            "human_name": None,
            "intent": None,
            "agent_used": None,
            "actions": None,
            "suggestions": None,
            "created_at": "2026-09-17T09:12:00Z",
        },
        {
            "role": "assistant",
            "content": (
                "Bonjour. Pour doubler vos commandes, deux leviers comptent plus que les autres : "
                "la relance des paniers abandonnés et la preuve sociale sur vos pages produit. "
                "Souhaitez-vous que nous regardions votre tunnel actuel ?"
            ),
            "human_name": None,
            # Clé de routage interne : elle ne doit JAMAIS s'afficher.
            "agent_used": "sales-coach",
            "intent": "ventes",
            "actions": None,
            "suggestions": ["Voir mon tunnel", "Parler à un conseiller"],
            "created_at": "2026-09-17T09:12:04Z",
        },
        {
            "role": "user",
            "content": "Oui, je veux bien. Je peux vous appeler demain matin.",
            "human_name": None,
            "intent": None,
            "agent_used": None,
            "actions": None,
            "suggestions": None,
            "created_at": "2026-09-18T09:02:00Z",
        },
        {
            "role": "assistant",
            "content": "Très bien. Un conseiller vous rappelle demain matin.",
            "human_name": None,
            "agent_used": None,
            "intent": None,
            "actions": None,
            "suggestions": ["Voir mes messages"],
            "created_at": "2026-09-18T09:04:00Z",
        },
    ],
}

REPONSE_MIA = {
    "text": (
        "Deux leviers comptent plus que les autres pour doubler des commandes en ligne : "
        "la relance des paniers abandonnés (souvent 10 à 15 % du chiffre d'affaires récupérable) "
        "et la preuve sociale sur les pages produit. Par où souhaitez-vous commencer ?"
    ),
    "html": None,
    "files": None,
    "metadata": {
        "conversation_id": "conv_9f31ac02",
        "intent": "ventes",
        "agent_used": "sales-coach",
        "actions": None,
        "suggestions": ["Relancer les paniers", "Ajouter des avis clients"],
        "processing_time": 1.2,
        "human_active": False,
    },
}


# ==========================================================================
# Serveur statique (+ relais facultatif vers l'API de production)
# ==========================================================================


class Serveur(http.server.SimpleHTTPRequestHandler):
    relais: bool = False

    def log_message(self, *args):  # type: ignore[override]
        pass

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type, authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _relayer(self, methode: str) -> None:
        longueur = int(self.headers.get("Content-Length") or 0)
        corps = self.rfile.read(longueur) if longueur else None
        requete = urllib.request.Request(
            API_PRODUCTION + self.path, data=corps,
            headers={"Content-Type": "application/json"}, method=methode,
        )
        code, donnees = 502, b'{"detail":"relais indisponible"}'
        try:
            with urllib.request.urlopen(requete, timeout=90) as reponse:
                code, donnees = reponse.status, reponse.read()
        except urllib.error.HTTPError as erreur:
            code, donnees = erreur.code, erreur.read()
        except Exception:  # noqa: BLE001 — le harnais ne doit jamais mourir sur le réseau
            pass
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.send_header("Content-Length", str(len(donnees)))
        self.end_headers()
        self.wfile.write(donnees)

    def do_GET(self) -> None:  # noqa: N802
        if self.relais and self.path.startswith("/api/"):
            self._relayer("GET")
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        if self.relais and self.path.startswith("/api/"):
            self._relayer("POST")
            return
        self.send_error(404)


def demarrer_serveur(relais: bool) -> socketserver.ThreadingTCPServer:
    handler = functools.partial(Serveur, directory=str(DEPOT))
    Serveur.relais = relais
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    serveur = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    return serveur


# ==========================================================================
# API simulée (console + widget)
# ==========================================================================


def repondre(route, donnees, status: int = 200) -> None:
    route.fulfill(status=status, content_type="application/json",
                  body=json.dumps(donnees, ensure_ascii=False))


def installer_api(page: Page) -> dict:
    """Aucune requête ne sort : les images sont reproductibles à l'octet.

    Rend un compteur d'appels réellement interceptés. Un écran de la console
    dont le compteur reste à zéro est un écran SANS DONNÉES : le tableau de bord
    afficherait des zéros, la boîte de réception une liste vide, et la maquette
    serait fausse sans que rien ne le dise. Le compteur transforme ce silence en
    défaut visible (voir le contrôle dans `capturer_console`).
    """
    compteur = {"appels": 0, "chemins": []}

    def traiter(route) -> None:
        try:
            _traiter(route, compteur)
        except Exception:
            import traceback as _tb
            print("   !! EXCEPTION DANS LE GESTIONNAIRE DE ROUTE:")
            _tb.print_exc()
            raise

    def _traiter(route, compteur) -> None:
        chemin = route.request.url.replace(API_PRODUCTION, "")
        compteur["appels"] += 1
        compteur["chemins"].append(chemin)
        if route.request.method == "POST":
            repondre(route, REPONSE_MIA)
            return
        if "/admin/stats" in chemin:
            repondre(route, JEUX["stats"])
            return
        if re.search(r"/admin/conversations/[^/?]+$", chemin):
            repondre(route, JEUX["detail"])
            return
        if "/admin/conversations" in chemin:
            repondre(route, {"conversations": JEUX["conversations"],
                             "total": len(JEUX["conversations"])})
            return
        if "/admin/users" in chemin:
            repondre(route, {"users": JEUX["utilisateurs"], "total": len(JEUX["utilisateurs"])})
            return
        if "/admin/candidats" in chemin:
            repondre(route, {"candidats": JEUX["candidats"], "total": len(JEUX["candidats"])})
            return
        if re.search(r"/api/chatbot/conversation/[^/?]+$", chemin):
            repondre(route, HISTORIQUE)
            return
        if chemin.endswith("/agents"):
            repondre(route, JEUX["agents"])
            return
        repondre(route, {"detail": "non simulé"}, 404)

    page.route(MOTIF_API, traiter)
    return compteur


# ==========================================================================
# Contexte de page
# ==========================================================================


def contexte(browser: Browser, largeur: int, hauteur: int, theme: str,
             amorce: list[str] | None = None) -> BrowserContext:
    """Un contexte par (gabarit, thème) : échelle 2, locale française, schéma de
    couleurs forcé — le thème clair et le thème sombre sont tous deux
    déterministes, indépendamment des préférences de la machine de mesure."""
    ctx = browser.new_context(
        viewport={"width": largeur, "height": hauteur},
        device_scale_factor=ECHELLE,
        locale="fr-FR",
        color_scheme="dark" if theme == "sombre" else "light",
    )
    # Horloge figée, posée avant tout script de page. Les libellés relatifs du
    # produit (« il y a 12 heures ») sont calculés à partir de l'heure courante :
    # sans cette épinglette, deux exécutions à une heure d'écart produisent des
    # images différentes — mesuré, 34 maquettes sur 112. Une maquette de
    # référence qui change toute seule n'est pas une référence.
    ctx.add_init_script(
        "try {"
        f"  var FIXE = Date.parse('{HORLOGE_FIGEE}');"
        "  var Origine = Date;"
        "  function DateFigee(...args) {"
        "    return args.length ? new Origine(...args) : new Origine(FIXE);"
        "  }"
        "  DateFigee.prototype = Origine.prototype;"
        "  DateFigee.now = function () { return FIXE; };"
        "  DateFigee.parse = Origine.parse;"
        "  DateFigee.UTC = Origine.UTC;"
        "  window.Date = DateFigee;"
        "} catch (e) {}")
    if amorce:
        ctx.add_init_script("\n".join(["try {", *amorce, "} catch (e) {}"]))
    return ctx


def nom_fichier(serie: str, ecran: str, gabarit: str, theme: str, suffixe: str = "") -> str:
    """`<ecran>-<gabarit>-<theme>.png` — nomenclature imposée par la consigne."""
    return f"{serie}-{ecran}{suffixe}-{gabarit}-{theme}.png"


def capturer(page: Page, cible: Path, clip: dict | None = None) -> dict:
    page.screenshot(path=str(cible), animations="disabled", clip=clip)
    donnees = cible.read_bytes()
    return {
        "fichier": cible.name,
        "md5": hashlib.md5(donnees).hexdigest(),
        "octets": len(donnees),
    }


def tissu(page, gabarit: str, theme: str, serie: str, ecran: str,
          fenetre: dict | None = None) -> dict:
    """Ce que le moteur a réellement rendu — la mesure accompagne l'image.

    `page` accepte un Page comme une Frame : le widget visiteur est mesuré dans
    l'iframe, où le texte rendu est celui DU WIDGET, pas celui du site hôte.
    C'est exactement ce qu'on veut vérifier (aucun terme d'agent interne).
    """
    if fenetre is None:
        fenetre = {"w": page.viewport_size["width"], "h": page.viewport_size["height"]}
    texte = page.inner_text("body")
    return {
        "serie": serie, "ecran": ecran, "gabarit": gabarit, "theme": theme,
        "fenetre": fenetre,
        "echelle": ECHELLE,
        "longueur_texte": len(texte),
        "termes_internes_presents": sorted({t for t in TERMES_INTERNES if t in texte}),
    }


# ==========================================================================
# Série 1 — widget visiteur, dans la page d'un site hôte
# ==========================================================================


def url_hote(theme: str, cta: bool) -> str:
    # Pas de paramètre `api` : le widget garde son URL d'API de PRODUCTION, qui
    # est interceptée par le harnais. Pointer le widget sur le serveur local
    # ferait répondre ce serveur (404 sur /api/…) et l'écran Conversation
    # retomberait silencieusement sur un fil vide — c'est exactement ce que le
    # contrôle `attendu` attrape.
    return (f"{BASE}{ENTREES['hote']}?widget={ENTREES['widget']}&theme={theme}"
            f"&cta={'1' if cta else '0'}")


def ouvrir_widget(page: Page) -> None:
    """Le SDK pose la bulle ; on l'ouvre comme un visiteur — au clic."""
    page.wait_for_selector("#eperformance-widget-bubble")
    page.click("#eperformance-widget-bubble")
    page.wait_for_selector("#eperformance-widget-holder iframe")
    page.wait_for_timeout(DELAIS["chargement"])


def cadre_widget(page: Page):
    return next((f for f in page.frames
                 if f is not page.main_frame and ENTREES["widget"] in f.url), None)


def capturer_widget(browser: Browser, serie: dict, index: list) -> None:
    """Un chargement de page PAR ÉCRAN.

    Réutiliser une page pour les cinq écrans a été essayé, et le harnais a
    échoué sur l'écran Conversation : la capture d'écran de l'écran précédent
    (2880×1800 en échelle 2) bloque le fil qui distribue les requêtes
    interceptées, la reprise de conversation reste en attente, et la copie de
    l'application l'annule (`net::ERR_FAILED`). Le fil retombait alors sur le
    message d'accueil, et la maquette aurait montré une conversation vide en
    croyant montrer un fil repris.

    Un chargement par écran supprime la course, et donne en plus à chaque
    maquette un état de départ propre — ce qu'une maquette de référence doit
    montrer. C'est le harnais lui-même qui a rendu ce défaut visible : sans le
    contrôle `attendu`, 25 images d'écrans vides auraient été écrites.
    """
    print(f"Série « {serie['libelle']} »")
    ecrans = serie["ecrans"]
    for gabarit, dims in GABARITS.items():
        largeur, hauteur = dims["largeur"], dims["hauteur"]
        for theme in THEMES:
            t = "dark" if theme == "sombre" else "light"
            ctx = contexte(browser, largeur, hauteur, theme, [
                # Une conversation restaurée du serveur : l'écran Conversation
                # montre un fil réel, pas un état vide. Le script d'amorçage
                # s'applique à TOUS les cadres, iframe du widget comprise.
                "  window.localStorage.setItem('eperf_conversation_id', 'conv_9f31ac02');",
            ])

            # Le point d'entrée : la page du site hôte, widget FERMÉ, la bulle
            # posée. C'est le premier état que voit un visiteur.
            page = ctx.new_page()
            installer_api(page)
            page.goto(url_hote(t, cta=False), wait_until="load")
            page.wait_for_selector("#eperformance-widget-bubble")
            page.wait_for_timeout(DELAIS["stabilisation"])
            cible = MAQUETTES / nom_fichier("widget", "en-contexte-ferme", gabarit, theme)
            mesures = capturer(page, cible)
            mesures.update(tissu(page, gabarit, theme, "widget", "en-contexte-ferme"))
            mesures["contexte"] = "page du site hôte, widget fermé (bulle visible)"
            index.append(mesures)
            print(f"  · {cible.name}")
            page.close()

            for ecran in ecrans:
                page = ctx.new_page()
                installer_api(page)
                page.goto(url_hote(t, cta=False), wait_until="load")
                ouvrir_widget(page)
                cadre = cadre_widget(page)
                if cadre is None:
                    raise RuntimeError("iframe du widget introuvable")

                # Navigation par le GESTE réel quand l'onglet existe (c'est ce
                # que fait un visiteur), par la route sinon (Conversation n'est
                # pas un onglet : on y entre par l'accueil ou une suggestion).
                onglet = ecran.get("onglet")
                existe = onglet is not None and cadre.evaluate(
                    "(sel) => Boolean(document.querySelector(sel))", f"#ep-tab-{onglet}")
                if existe:
                    cadre.click(f"#ep-tab-{onglet}")
                else:
                    cadre.evaluate(f"() => {{ location.hash = '{ecran['route']}' }}")
                cadre.wait_for_selector(ecran["selecteur"], timeout=20_000)
                verifier_attendu(cadre, ecran,
                                 f"widget « {ecran['nom']} » ({gabarit}, {theme})")
                page.wait_for_timeout(DELAIS["stabilisation"])

                boite = page.locator("#eperformance-widget-holder iframe").bounding_box()
                clip = None
                if boite:
                    clip = {"x": max(boite["x"], 0), "y": max(boite["y"], 0),
                            "width": boite["width"], "height": boite["height"]}
                cible = MAQUETTES / nom_fichier("widget", ecran["nom"], gabarit, theme)
                mesures = capturer(page, cible, clip)
                mesures.update(tissu(cadre, gabarit, theme, "widget", ecran["nom"],
                                     fenetre={"w": largeur, "h": hauteur}))
                mesures["contexte"] = "page d'un site hôte, widget ouvert"
                index.append(mesures)
                print(f"  · {cible.name}")

                # Le widget ouvert DANS son contexte, en desktop seulement : en
                # mobile le panneau couvre la page entière (390 px), la capture
                # serait identique à celle du panneau — une image en double.
                if gabarit == "desktop-1440x900" and ecran["nom"] == "accueil":
                    cible = MAQUETTES / nom_fichier("widget", "en-contexte-ouvert", gabarit, theme)
                    mesures = capturer(page, cible)
                    mesures.update(tissu(page, gabarit, theme, "widget", "en-contexte-ouvert"))
                    mesures["contexte"] = "page du site hôte entière, widget ouvert"
                    index.append(mesures)
                    print(f"  · {cible.name}")
                page.close()
            ctx.close()


# ==========================================================================
# Série 2 — console d'administration (11 modules)
# ==========================================================================


def capturer_console(browser: Browser, serie: dict, index: list) -> None:
    print(f"Série « {serie['libelle']} »")
    for gabarit, dims in GABARITS.items():
        largeur, hauteur = dims["largeur"], dims["hauteur"]
        for theme in THEMES:
            t = "dark" if theme == "sombre" else "light"
            for ecran in serie["ecrans"]:
                if "gabarits" in ecran and gabarit not in ecran["gabarits"]:
                    continue
                # Une PAGE par écran : le script d'amorçage (thème, jeton) ne
                # s'applique qu'au chargement d'un document.
                ctx = contexte(browser, largeur, hauteur, theme, [
                    f"  window.localStorage.setItem('eperf-theme', '{t}');",
                    f"  window.localStorage.setItem('eperf_admin_token', '{JETON}');",
                ])
                page = ctx.new_page()
                compteur = installer_api(page)
                page.goto(f"{BASE}{ENTREES['console']}{ecran['route']}", wait_until="domcontentloaded")
                page.wait_for_selector(ecran["selecteur"], timeout=25_000)
                page.evaluate("document.fonts ? document.fonts.ready : null")
                if ecran.get("action") == "clic" and ecran.get("selecteur_apres"):
                    page.click(ecran["selecteur"])
                    page.wait_for_selector(ecran["selecteur_apres"], timeout=20_000)
                page.wait_for_timeout(DELAIS["stabilisation"])
                verifier_attendu(page, ecran,
                                 f"console « {ecran['nom']} » ({gabarit}, {theme})")

                cible = MAQUETTES / nom_fichier("console", ecran["nom"], gabarit, theme)
                mesures = capturer(page, cible)
                mesures.update(tissu(page, gabarit, theme, "console", ecran["nom"]))
                mesures["appels_api_interceptes"] = compteur["appels"]
                mesures["chemins_api"] = sorted(set(compteur["chemins"]))
                mesures["modules_atteignables"] = sorted(
                    page.eval_on_selector_all(
                        "a.adm-lien", "noeuds => noeuds.map(n => n.dataset.module).filter(Boolean)")
                )
                # Contrôle de validité : sans un seul appel intercepté, la
                # maquette montrerait un écran vide — elle serait fausse.
                if compteur["appels"] == 0:
                    raise RuntimeError(
                        f"écran « {ecran['nom']} » : aucun appel d'API intercepté — "
                        f"la maquette serait un écran sans données")
                index.append(mesures)
                print(f"  · {cible.name}")
                page.close()
                ctx.close()


# ==========================================================================
# Série 3 — application Mia (document de premier niveau)
# ==========================================================================


def url_application(largeur: int, theme: str, route: str, api: str | None = None) -> str:
    """URL de l'application. `api` n'est posé QUE pour la série réelle : là, les
    appels doivent passer par le relais local (le backend de production
    n'autorise pas l'origine 127.0.0.1)."""
    vue = "mobile" if largeur <= 668 else "desktop"
    suffixe = f"&apiUrl={api}" if api else ""
    return f"{BASE}{ENTREES['widget']}?app=1&theme={theme}&viewport={vue}{suffixe}{route}"


def verifier_attendu(cadre, ecran: dict, ou: str) -> None:
    """Le fragment attendu doit être LÀ, dans un délai borné.

    Un écran sans ses données est une maquette fausse, et une maquette fausse
    est pire qu'aucune maquette : elle affirme un état qui n'existe pas.

    On ATTEND le fragment au lieu de lire le texte après un délai fixe : un
    écran de conversation affiche d'abord « Reprise de la conversation… », et
    une lecture trop tôt photographierait cet état intermédiaire en croyant
    tenir l'état stable. `cadre` accepte un Page comme une Frame.
    """
    attendu = ecran.get("attendu")
    if not attendu:
        return
    try:
        cadre.wait_for_function(
            "(attendu) => document.body.innerText.includes(attendu)",
            arg=attendu, timeout=25_000)
    except Exception as erreur:  # noqa: BLE001 — on veut le nom de l'écran
        raise RuntimeError(
            f"{ou} : le texte attendu « {attendu} » n'est jamais apparu — les "
            f"données ne sont pas arrivées jusqu'à l'écran, la maquette serait "
            f"un écran vide") from erreur


def capturer_application(browser: Browser, serie: dict, index: list) -> None:
    print(f"Série « {serie['libelle']} »")
    for gabarit, dims in GABARITS.items():
        largeur, hauteur = dims["largeur"], dims["hauteur"]
        for theme in THEMES:
            t = "dark" if theme == "sombre" else "light"
            for ecran in serie["ecrans"]:
                ctx = contexte(browser, largeur, hauteur, theme, [
                    # Une conversation restaurée du serveur : l'écran
                    # Conversation montre un fil réel, pas un état vide.
                    f"  window.localStorage.setItem('eperf_conversation_id', 'conv_9f31ac02');",
                ])
                page = ctx.new_page()
                installer_api(page)
                page.goto(url_application(largeur, t, ecran["route"]), wait_until="load")
                page.wait_for_selector(ecran["selecteur"], timeout=25_000)
                page.evaluate("document.fonts ? document.fonts.ready : null")
                page.wait_for_timeout(DELAIS["chargement"])
                verifier_attendu(page, ecran,
                                 f"application « {ecran['nom']} » ({gabarit}, {theme})")

                cible = MAQUETTES / nom_fichier("application", ecran["nom"], gabarit, theme)
                mesures = capturer(page, cible)
                mesures.update(tissu(page, gabarit, theme, "application", ecran["nom"]))
                mesures["mode"] = page.evaluate(
                    "() => document.documentElement.getAttribute('data-mode')")
                index.append(mesures)
                print(f"  · {cible.name}")
                page.close()
                ctx.close()


# ==========================================================================
# Série 4 — pages publiques
# ==========================================================================


def capturer_pages(browser: Browser, serie: dict, index: list) -> None:
    print(f"Série « {serie['libelle']} »")
    for gabarit, dims in GABARITS.items():
        largeur, hauteur = dims["largeur"], dims["hauteur"]
        for theme in THEMES:
            for ecran in serie["ecrans"]:
                ctx = contexte(browser, largeur, hauteur, theme)
                page = ctx.new_page()
                page.goto(f"{BASE}{ecran['chemin']}?theme={'dark' if theme == 'sombre' else 'light'}",
                          wait_until="load")
                page.evaluate("document.fonts ? document.fonts.ready : null")
                page.wait_for_timeout(DELAIS["chargement"])
                for section in serie["sections"]:
                    if section == "bas":
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        page.wait_for_timeout(700)
                    cible = MAQUETTES / nom_fichier("pages", ecran["nom"], gabarit, theme,
                                                    suffixe=f"-{section}")
                    mesures = capturer(page, cible)
                    mesures.update(tissu(page, gabarit, theme, "pages", f"{ecran['nom']}-{section}"))
                    index.append(mesures)
                    print(f"  · {cible.name}")
                ctx.close()


# ==========================================================================
# Série 5 — conversation réelle (API de production, hors maquettes)
# ==========================================================================


def capturer_conversation_reelle(browser: Browser, index: list) -> None:
    """Preuve de bout en bout : Mia répond réellement.

    Cette série n'est PAS reproductible à l'octet (elle dépend du modèle) :
    elle est produite à part, dans `maquettes/conversation-reelle/`, et n'entre
    pas dans le compte des maquettes de référence. Elle sert de base à la mesure
    des emoji de la tâche 6.9 — mesurer une réponse simulée ne prouverait rien.
    """
    print("Série « conversation réelle » (API de production)")
    dossier = MAQUETTES / "conversation-reelle"
    dossier.mkdir(parents=True, exist_ok=True)
    questions = [
        "Bonjour, je vends des cosmétiques en ligne et je veux doubler mes commandes.",
        "Comment gagner en visibilité sans payer de publicité ?",
        "Est-ce que je peux automatiser la relance de mes clients ?",
        "Combien coûte un accompagnement ?",
        "Je veux un site qui convertit mieux, par où commencer ?",
        "Bonjour",
        "Merci beaucoup, c'est très clair.",
        "Je veux arrêter de perdre du temps sur les devis.",
        "Quels sont vos délais ?",
        "Pouvez-vous m'aider pour le référencement local ?",
    ]
    for gabarit, dims in GABARITS.items():
        largeur, hauteur = dims["largeur"], dims["hauteur"]
        for theme in THEMES:
            t = "dark" if theme == "sombre" else "light"
            ctx = contexte(browser, largeur, hauteur, theme)
            page = ctx.new_page()
            page.goto(url_application(largeur, t, "#/conversation", api=BASE), wait_until="load")
            page.wait_for_selector(".ep-contenu", timeout=25_000)
            page.wait_for_timeout(DELAIS["chargement"])

            reponses: list[str] = []
            champs = page.locator(".ep-input")
            for question in questions:
                try:
                    champs.fill(question)
                    page.locator(".ep-send").click()
                    page.wait_for_timeout(DELAIS["conversation"])
                    texte = page.inner_text(".ep-contenu")
                    reponses.append(texte)
                except Exception as erreur:  # noqa: BLE001
                    print(f"    (question ignorée : {erreur})")
            cible = dossier / nom_fichier("conversation-reelle", "fil", gabarit, theme)
            mesures = capturer(page, cible)
            mesures.update(tissu(page, gabarit, theme, "conversation-reelle", "fil"))
            mesures["reponses_capturees"] = reponses
            index.append(mesures)
            print(f"  · {cible.name}")
            page.close()
            ctx.close()


# ==========================================================================
# Index et planche de synthèse
# ==========================================================================


def ecrire_index(index: list) -> Path:
    """Écrit l'index, une entrée par fichier.

    Dédoublonnage par nom de fichier, la dernière mesure gagnant : régénérer
    une série ne doit pas laisser deux entrées pour la même image — l'index
    décrit ce qui est sur le disque, une fois.
    """
    uniques: dict[str, dict] = {}
    for mesure in index:
        uniques[mesure["fichier"]] = mesure
    chemin = DOSSIER / "maquettes.index.json"
    chemin.write_text(json.dumps({
        "version": CONFIG["version"],
        "echelle": ECHELLE,
        "nomenclature": CONFIG["nomenclature"],
        "gabarits": GABARITS,
        "themes": THEMES,
        "total": len(uniques),
        "images": sorted(uniques.values(), key=lambda m: m["fichier"]),
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return chemin


def planche() -> Path:
    """Planche de synthèse : une image par série, en colonnes.

    Facultative, et utile : le propriétaire voit d'un coup d'œil les 23 écrans
    d'une série dans un seul fichier. Elle est recomposée depuis les maquettes
    DÉJÀ écrites — aucune capture supplémentaire, donc aucun risque de
    divergence entre la planche et les maquettes.
    """
    from PIL import Image, ImageDraw

    series = {
        "01-widget": [m for m in index_global if m["serie"] == "widget" and m["theme"] == "clair"],
        "02-console": [m for m in index_global if m["serie"] == "console" and m["theme"] == "clair"],
        "03-application": [m for m in index_global if m["serie"] == "application" and m["theme"] == "clair"],
        "04-pages": [m for m in index_global if m["serie"] == "pages" and m["theme"] == "clair"],
    }
    largeur_vignette, hauteur_vignette = 300, 200
    colonnes = 6
    marges, entete = 24, 46
    planches = []
    for nom_serie, mesures in series.items():
        if not mesures:
            continue
        lignes = (len(mesures) + colonnes - 1) // colonnes
        grand = Image.new("RGB", (marges * 2 + colonnes * (largeur_vignette + 12),
                                  entete + lignes * (hauteur_vignette + 30) + marges),
                          (253, 252, 250))
        dessin = ImageDraw.Draw(grand)
        dessin.text((marges, 16), f"{nom_serie}  —  {len(mesures)} maquettes (thème clair)",
                    fill=(22, 21, 26))
        for i, mesure in enumerate(sorted(mesures, key=lambda m: m["fichier"])):
            x = marges + (i % colonnes) * (largeur_vignette + 12)
            y = entete + (i // colonnes) * (hauteur_vignette + 30)
            image = Image.open(MAQUETTES / mesure["fichier"]).convert("RGB")
            image.thumbnail((largeur_vignette, hauteur_vignette))
            grand.paste(image, (x, y))
            dessin.text((x, y + image.height + 4), mesure["fichier"][:46], fill=(106, 103, 111))
        chemin = MAQUETTES / f"planche-{nom_serie}.png"
        grand.save(chemin)
        planches.append(chemin)
        print(f"  · {chemin.name} ({grand.width}x{grand.height})")
    return planches


index_global: list = []


# ==========================================================================
# Entrée
# ==========================================================================


def main() -> int:
    global index_global
    cible = sys.argv[1] if len(sys.argv) > 1 else "tout"
    MAQUETTES.mkdir(parents=True, exist_ok=True)
    index_global = []
    chemin_index = DOSSIER / "maquettes.index.json"
    if chemin_index.is_file():
        # Une entrée dont l'image n'existe plus est une entrée périmée : un
        # changement de nomenclature laisserait sinon des fantômes dans l'index
        # et dans la planche. L'index décrit ce qui est SUR LE DISQUE.
        index_global = [
            m for m in json.loads(chemin_index.read_text(encoding="utf-8"))["images"]
            if (MAQUETTES / m["fichier"]).is_file()
        ]

    relais = cible == "conversation-reelle"
    serveur = demarrer_serveur(relais)
    try:
        with sync_playwright() as p:
            navigateur = p.chromium.launch()
            if cible in ("tout", "widget"):
                capturer_widget(navigateur, CONFIG["series"]["widget"], index_global)
            if cible in ("tout", "console"):
                capturer_console(navigateur, CONFIG["series"]["console"], index_global)
            if cible in ("tout", "application"):
                capturer_application(navigateur, CONFIG["series"]["application"], index_global)
            if cible in ("tout", "pages"):
                capturer_pages(navigateur, CONFIG["series"]["pages"], index_global)
            if cible == "conversation-reelle":
                capturer_conversation_reelle(navigateur, index_global)
            navigateur.close()

        chemin = ecrire_index(index_global)
        # Le compte affiché est celui du FICHIER écrit, pas celui de la liste de
        # travail : après dédoublonnage les deux diffèrent (224 en mémoire, 112
        # sur le disque), et c'est le fichier que le lecteur ouvrira.
        ecrites = json.loads(chemin.read_text(encoding="utf-8"))["total"]
        print(f"\nindex : {ecrites} images ecrites dans {chemin.name}")
        planche()
    finally:
        serveur.shutdown()
        try:
            serveur.server_close()
        except OSError:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
