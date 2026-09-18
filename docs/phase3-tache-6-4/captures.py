#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Captures et mesures de la tâche 6.4 (Bloc B — PWA Mia, pages publiques).

Ce script produit, dans ce dossier :
  · les captures AVANT / APRÈS de chaque écran du widget touché par la tâche
    (Accueil, Messages, Conversation, Aide, Actualités) en clair et en sombre,
    mobile 390×844 et desktop 1440×900 ;
  · les captures de l'invite d'installation (présente / absente au premier
    chargement), en mode application ET dans une iframe de site hôte ;
  · les captures de l'écran hors-ligne (coupure réseau RÉELLE, via Playwright) ;
  · les captures des nouvelles pages publiques (/application et
    /application/mia), en clair et en sombre, mobile et desktop ;
  · les images de preuve déployées (public/preuves/) : aperçus de
    l'application et visuel de partage ;
  · `mesures-invite-installation.json` : rectangles et SURFACES DE
    RECOUVREMENT en px² de l'invite avec la zone de saisie et le bouton
    d'envoi, sur les 4 gabarits demandés (390×844, 414×896, 768×1024,
    1440×900) — même méthode que la tâche 6.2-BIS pour `.sticky-cta` ;
  · `mesures-pwa.json` : manifeste lu par Chromium (CDP `Page.getAppManifest`),
    service worker actif, opacité du mode application.

Le serveur statique sert la racine du dépôt : les builds `dist/` (après) et
`docs/phase3-tache-6-3-bis/dist-avant/` (avant) y sont lus tels quels — aucun
dépôt n'est modifié, aucun fichier n'est écrit hors de ce dossier et de
`public/preuves/`.

    python3 captures.py preuves       # images de public/preuves/
    python3 captures.py ecrans        # avant/après, 5 écrans × 2 thèmes × 2 gabarits
    python3 captures.py invite        # invite présente / absente (application + iframe)
    python3 captures.py horsligne     # écran d'attente, coupure réseau réelle
    python3 captures.py pages         # /application et /application/mia
    python3 captures.py mesures       # mesures (invite, non-régression, PWA)
    python3 captures.py tout
"""

from __future__ import annotations

import functools
import http.server
import json
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import Browser, Page, sync_playwright

DEPOT = Path(__file__).resolve().parents[2]  # …/eperformance-widget
DOSSIER = Path(__file__).resolve().parent
PREUVES = DEPOT / "public" / "preuves"
PORT = 8104
BASE = f"http://127.0.0.1:{PORT}"
API_PRODUCTION = "https://web-production-4ab53.up.railway.app"
HARNAIS = "/docs/phase3-tache-6-4/hote-6-4.html"
GABARIT_PARTAGE = "/docs/phase3-tache-6-4/_gabarit-partage.html"

# Builds comparés
# AVANT = le build du commit précédent (32d0e83, 6.3-BIS livré), reconstruit
# dans docs/phase3-tache-6-4/dist-avant/ : le « avant » de CETTE tâche, et non
# celui de la tâche 6.3-BIS (qui comparait un état plus ancien).
AVANT = "/docs/phase3-tache-6-4/dist-avant/index.html"
APRES = "/dist/index.html"

# Écrans du widget (routeur à hash) + onglet porteur de l'onglet actif
ECRANS = [
    ("accueil", "#/"),
    ("messages", "#/messages"),
    ("conversation", "#/conversation"),
    ("aide", "#/aide"),
    ("actualites", "#/actualites"),
]

GABARITS = {
    "mobile-390x844": (390, 844),
    "mobile-414x896": (414, 896),
    "tablette-768x1024": (768, 1024),
    "desktop-1440x900": (1440, 900),
}

# Les 4 gabarits exacts demandés par la consigne, pour la mesure de l'invite
GABARITS_MESURE = [
    ("390x844", 390, 844),
    ("414x896", 414, 896),
    ("768x1024", 768, 1024),
    ("1440x900", 1440, 900),
]

# État mémorisé qui rend l'invite légitime : 2 visites, aucun refus
ETAT_INVITE = json.dumps({"refusLe": None, "visites": 2, "installee": False})

DELAI_INVITE_MS = 12_000


# --------------------------------------------------------------------------
# Serveur statique
# --------------------------------------------------------------------------


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


# --------------------------------------------------------------------------
# JavaScript de mesure (exécuté DANS le document)
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
  const invite = document.querySelector('[data-testid="invite-installation"]')
  const zone = document.querySelector('.ep-input-zone')
  const envoi = document.querySelector('.ep-send')
  const message = document.querySelector('.ep-input')
  const onglets = document.querySelector('.ep-tabs')
  const rInvite = rect(invite), rZone = rect(zone), rEnvoi = rect(envoi), rMessage = rect(message)
  const rOnglets = rect(onglets)
  const style = invite ? getComputedStyle(invite) : null
  return {
    fenetre: { w: window.innerWidth, h: window.innerHeight },
    mode: document.documentElement.getAttribute('data-mode') || 'widget',
    theme: document.documentElement.getAttribute('data-theme'),
    invite_presente: Boolean(invite),
    invite_position: style ? style.position : null,
    invite: rInvite,
    zone_saisie_presente: Boolean(zone),
    bouton_envoi_present: Boolean(envoi),
    zone_saisie: rZone,
    bouton_envoi: rEnvoi,
    champ_message: rMessage,
    barre_onglets: rOnglets,
    chevauchement_invite_onglets_px2: intersection(rInvite, rOnglets),
    chevauchement_invite_zone_px2: intersection(rInvite, rZone),
    chevauchement_invite_envoi_px2: intersection(rInvite, rEnvoi),
    /* Le bouton d'envoi doit aussi rester cliquable : on vérifie que le point
       central du bouton est bien l'élément atteint au hit-test. */
    envoi_au_hit_test: (() => {
      if (!rEnvoi) return null
      const el = document.elementFromPoint((rEnvoi.x + rEnvoi.right) / 2, (rEnvoi.y + rEnvoi.bottom) / 2)
      return el ? (el.closest('.ep-send') ? 'bouton-envoi' : el.tagName.toLowerCase()) : null
    })(),
  }
}"""

MESURE_HOTE_JS = """() => {
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
  return {
    fenetre: { w: window.innerWidth, h: window.innerHeight },
    barre_cta: rect(barre),
    bouton_whatsapp: rect(whatsapp),
    bulle: rect(bulle),
    bulle_visible: bulle ? getComputedStyle(bulle).display !== 'none' : null,
    chevauchement_bulle_whatsapp_px2: intersection(rect(bulle), rect(whatsapp)),
    chevauchement_bulle_barre_px2: intersection(rect(bulle), rect(barre)),
    z_index_holder: holder ? getComputedStyle(holder).zIndex : null,
  }
}"""


# --------------------------------------------------------------------------
# Utilitaires
# --------------------------------------------------------------------------


def contexte(browser: Browser, largeur: int, hauteur: int, theme: str = "light",
             invite: bool = False, hors_ligne: bool = False):
    ctx = browser.new_context(
        viewport={"width": largeur, "height": hauteur},
        device_scale_factor=1,
        locale="fr-FR",
        color_scheme="dark" if theme == "dark" else "light",
    )
    if invite:
        # État mémorisé qui autorise l'invite : ce n'est pas un crochet de
        # test, c'est exactement ce qu'un visiteur de 2e visite a en mémoire.
        ctx.add_init_script(
            f"try {{ localStorage.setItem('eperf_mia_installation', {json.dumps(ETAT_INVITE)}) }} catch (e) {{}}"
        )
    if hors_ligne:
        ctx.set_offline(True)
    return ctx


def url_app(largeur: int, theme: str, hash_route: str = "#/") -> str:
    """URL de l'application (document de premier niveau), service par dist/."""
    viewport = "mobile" if largeur <= 668 else "desktop"
    # `apiUrl` pointe sur le proxy local : Mia répond réellement (le backend de
    # production n'autorise pas l'origine 127.0.0.1).
    return (
        f"{BASE}{APRES}?app=1&theme={theme}&viewport={viewport}"
        f"&apiUrl={BASE}{hash_route}"
    )


def url_harnais(widget: str, largeur: int, theme: str) -> str:
    """URL du harnais de site hôte, avec le build à tester."""
    return (
        f"{BASE}{HARNAIS}?widget={widget}&theme={theme}"
        f"&cta={'1' if largeur <= 900 else '0'}&api={BASE}"
    )


def capture(page: Page, nom: str) -> None:
    page.screenshot(path=str(DOSSIER / nom), full_page=False)
    print(f"  · {nom}")


def attendre_invite(page: Page) -> None:
    """L'invite n'apparaît qu'après le délai de politesse — on l'attend."""
    page.wait_for_timeout(DELAI_INVITE_MS + 1200)


# --------------------------------------------------------------------------
# 1. Images de preuve déployées (public/preuves/)
# --------------------------------------------------------------------------


def generer_preuves(browser: Browser) -> None:
    PREUVES.mkdir(parents=True, exist_ok=True)
    print("Images de preuve (public/preuves/)")

    # Aperçu mobile : l'application, écran d'accueil, thème clair
    ctx = contexte(browser, 390, 844, "light")
    page = ctx.new_page()
    page.goto(url_app(390, "light"), wait_until="load")
    page.wait_for_timeout(2500)
    page.screenshot(path=str(PREUVES / "mia-application-mobile.png"))
    ctx.close()
    print("  · public/preuves/mia-application-mobile.png (390×844)")

    # Aperçu ordinateur
    ctx = contexte(browser, 1440, 900, "light")
    page = ctx.new_page()
    page.goto(url_app(1440, "light"), wait_until="load")
    page.wait_for_timeout(2500)
    page.screenshot(path=str(PREUVES / "mia-application-ordinateur.png"))
    ctx.close()
    print("  · public/preuves/mia-application-ordinateur.png (1440×900)")

    # Visuel de partage (Open Graph / Twitter) : 1200×630
    ctx = contexte(browser, 1200, 630, "light")
    page = ctx.new_page()
    page.goto(f"{BASE}{GABARIT_PARTAGE}", wait_until="load")
    page.wait_for_timeout(1200)
    page.screenshot(path=str(PREUVES / "mia-partage.png"))
    ctx.close()
    print("  · public/preuves/mia-partage.png (1200×630)")


# --------------------------------------------------------------------------
# 2. Captures avant / après des écrans du widget
# --------------------------------------------------------------------------


def capturer_ecrans(browser: Browser) -> None:
    print("Captures avant/après des écrans du widget")
    for version, chemin in (("avant", AVANT), ("apres", APRES)):
        for nom_gabarit, (largeur, hauteur) in GABARITS.items():
            for theme in ("clair", "sombre"):
                t = "dark" if theme == "sombre" else "light"
                ctx = contexte(browser, largeur, hauteur, t)
                page = ctx.new_page()
                for ecran, route in ECRANS:
                    url = f"{BASE}{chemin}?theme={t}&viewport={'mobile' if largeur <= 668 else 'desktop'}{route}"
                    page.goto(url, wait_until="load")
                    page.wait_for_timeout(1600)
                    capture(page, f"{version}-{ecran}-{nom_gabarit}-{theme}.png")
                ctx.close()


# --------------------------------------------------------------------------
# 3. Invite d'installation : présente / absente
# --------------------------------------------------------------------------


def capturer_invite(browser: Browser) -> None:
    print("Invite d'installation — présence et position")
    for nom_gabarit, largeur, hauteur in GABARITS_MESURE:
        for theme in ("clair", "sombre"):
            t = "dark" if theme == "sombre" else "light"

            # (a) Mode application : premier chargement → aucune invite
            ctx = contexte(browser, largeur, hauteur, t)
            page = ctx.new_page()
            page.goto(url_app(largeur, t), wait_until="load")
            page.wait_for_timeout(2500)
            capture(page, f"invite-absente-premier-chargement-{nom_gabarit}-{theme}.png")
            ctx.close()

            # (b) Mode application : 2e visite → invite affichée
            ctx = contexte(browser, largeur, hauteur, t, invite=True)
            page = ctx.new_page()
            page.goto(url_app(largeur, t), wait_until="load")
            attendre_invite(page)
            capture(page, f"invite-presente-application-{nom_gabarit}-{theme}.png")
            ctx.close()

            # (c) Dans l'iframe d'un site hôte : l'invite ne recouvre rien
            ctx = contexte(browser, largeur, hauteur, t, invite=True)
            page = ctx.new_page()
            page.goto(url_harnais(APRES, largeur, t), wait_until="load")
            page.wait_for_selector("#eperformance-widget-bubble")
            page.click("#eperformance-widget-bubble")
            attendre_invite(page)
            capture(page, f"invite-presente-iframe-{nom_gabarit}-{theme}.png")
            ctx.close()


# --------------------------------------------------------------------------
# 4. Écran hors-ligne (coupure réseau réelle)
# --------------------------------------------------------------------------


def capturer_hors_ligne(browser: Browser) -> None:
    print("Écran hors-ligne (coupure réseau réelle)")
    for nom_gabarit in ("mobile-390x844", "desktop-1440x900"):
        largeur, hauteur = GABARITS[nom_gabarit]
        for theme in ("clair", "sombre"):
            t = "dark" if theme == "sombre" else "light"
            # Chargement normal (le service worker met la coquille en cache),
            # puis coupure du réseau et rechargement : c'est la vraie séquence
            # d'un visiteur qui perd la connexion.
            ctx = contexte(browser, largeur, hauteur, t)
            page = ctx.new_page()
            page.goto(url_app(largeur, t), wait_until="load")
            page.wait_for_timeout(2500)
            ctx.set_offline(True)
            page.evaluate("window.dispatchEvent(new Event('offline'))")
            page.wait_for_timeout(900)
            capture(page, f"hors-ligne-application-{nom_gabarit}-{theme}.png")
            ctx.close()


# --------------------------------------------------------------------------
# 5. Pages publiques
# --------------------------------------------------------------------------


def capturer_pages(browser: Browser) -> None:
    print("Pages publiques /application et /application/mia")
    for page_nom, chemin in (("portail", "/dist/application/index.html"),
                             ("mia", "/dist/application/mia/index.html")):
        for nom_gabarit in ("mobile-390x844", "desktop-1440x900"):
            largeur, hauteur = GABARITS[nom_gabarit]
            for theme in ("clair", "sombre"):
                t = "dark" if theme == "sombre" else "light"
                ctx = contexte(browser, largeur, hauteur, t)
                page = ctx.new_page()
                page.goto(f"{BASE}{chemin}", wait_until="load")
                page.wait_for_timeout(1800)
                capture(page, f"page-{page_nom}-haut-{nom_gabarit}-{theme}.png")
                # Bas de page : FAQ et pied de page
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(700)
                capture(page, f"page-{page_nom}-bas-{nom_gabarit}-{theme}.png")
                ctx.close()


# --------------------------------------------------------------------------
# 6. Mesures
# --------------------------------------------------------------------------


def mesurer_invite(browser: Browser) -> dict:
    """Trois situations mesurées par gabarit.

    L'invite et la zone de saisie ne coexistent JAMAIS à l'écran : la zone de
    saisie n'existe que sur l'écran Conversation (l'accueil n'a pas de champ,
    seulement la carte « Poser une question »), et l'invite ne s'affiche jamais
    sur cet écran — c'est la règle « jamais par-dessus une conversation en
    cours ». On mesure donc les DEUX côtés de la règle :

      · accueil, invite affichée → recouvrement avec la zone de saisie, le
        bouton d'envoi (absents) et la barre d'onglets (présente, et qui ne doit
        pas être recouverte non plus) ;
      · conversation, même état mémorisé → l'invite doit être ABSENTE alors que
        la zone de saisie et le bouton d'envoi sont là, intacts ;
      · iframe d'un site hôte, invite affichée → mêmes mesures que l'accueil,
        dans le contexte réel d'intégration.
    """
    print("Mesures — invite d'installation")
    resultats: dict = {}
    for nom_gabarit, largeur, hauteur in GABARITS_MESURE:
        for situation, route in (
            ("application-accueil", "#/"),
            ("application-conversation", "#/conversation"),
            ("iframe-accueil", None),
        ):
            cle = f"{nom_gabarit}-{situation}"
            ctx = contexte(browser, largeur, hauteur, "light", invite=True)
            page = ctx.new_page()
            if route is not None:
                page.goto(url_app(largeur, "light", route), wait_until="load")
                attendre_invite(page)
                mesures = page.evaluate(MESURE_JS)
                hote = None
            else:
                page.goto(url_harnais(APRES, largeur, "light"), wait_until="load")
                page.wait_for_selector("#eperformance-widget-bubble")
                page.click("#eperformance-widget-bubble")
                attendre_invite(page)
                hote = page.evaluate(MESURE_HOTE_JS)
                # Le cadre du widget est le seul qui ne soit PAS la page hôte :
                # l'URL du harnais contient elle aussi « dist/index.html » (en
                # paramètre), un filtre sur l'URL seule se tromperait de cadre.
                cadre = next(
                    (
                        f
                        for f in page.frames
                        if f is not page.main_frame and "/dist/index.html" in f.url
                    ),
                    None,
                )
                mesures = cadre.evaluate(MESURE_JS) if cadre else None
            resultats[cle] = {"cadre": mesures, "hote": hote}
            if mesures:
                print(
                    f"  · {cle} : invite={'oui' if mesures['invite_presente'] else 'non'} "
                    f"zone={'présente' if mesures['zone_saisie_presente'] else 'absente'} "
                    f"recouvrement zone={mesures['chevauchement_invite_zone_px2']} px² "
                    f"envoi={mesures['chevauchement_invite_envoi_px2']} px² "
                    f"onglets={mesures['chevauchement_invite_onglets_px2']} px²"
                )
            else:
                print(f"  · {cle} : cadre introuvable")
            ctx.close()
    return resultats


def mesurer_non_regression(browser: Browser) -> dict:
    print("Mesures — non-régression de la bulle sur site hôte (6.2-BIS)")
    resultats: dict = {}
    for nom_gabarit, largeur, hauteur in GABARITS_MESURE:
        ctx = contexte(browser, largeur, hauteur, "light")
        page = ctx.new_page()
        page.goto(url_harnais(APRES, largeur, "light"), wait_until="load")
        page.wait_for_selector("#eperformance-widget-bubble")
        page.wait_for_timeout(800)
        resultats[nom_gabarit] = page.evaluate(MESURE_HOTE_JS)
        print(
            f"  · {nom_gabarit} : bulle ↔ barre CTA = "
            f"{resultats[nom_gabarit]['chevauchement_bulle_barre_px2']} px²"
        )
        ctx.close()
    return resultats


def mesurer_pwa(browser: Browser) -> dict:
    print("Mesures — application installable (manifeste lu par Chromium)")
    resultats: dict = {}
    ctx = contexte(browser, 390, 844, "light")
    page = ctx.new_page()
    page.goto(url_app(390, "light"), wait_until="load")
    page.wait_for_timeout(3000)
    session = ctx.new_cdp_session(page)
    manifeste = session.send("Page.getAppManifest")
    sw = page.evaluate(
        """async () => {
            const enregistrement = await navigator.serviceWorker.getRegistration()
            return {
              enregistre: Boolean(enregistrement),
              portee: enregistrement ? enregistrement.scope : null,
              actif: enregistrement ? Boolean(enregistrement.active) : false,
              controleur: Boolean(navigator.serviceWorker.controller),
            }
        }"""
    )
    resultats["manifeste"] = {
        "url": manifeste.get("url"),
        "erreurs": manifeste.get("errors", []),
        "nom": (manifeste.get("data") or {}).get("name") if isinstance(manifeste.get("data"), dict) else None,
        "brut": manifeste.get("data") if isinstance(manifeste.get("data"), str) else None,
    }
    resultats["service_worker"] = sw
    resultats["mode_standalone_detecte"] = page.evaluate(
        "() => window.matchMedia('(display-mode: standalone)').matches"
    )
    resultats["mode_document"] = page.evaluate(
        "() => document.documentElement.getAttribute('data-mode')"
    )
    resultats["theme_color_meta"] = page.evaluate(
        "() => [...document.querySelectorAll('meta[name=theme-color]')].map((m) => m.content)"
    )
    resultats["apple_touch_icon"] = page.evaluate(
        "() => { const l = document.querySelector('link[rel=apple-touch-icon]'); return l ? l.getAttribute('href') : null }"
    )
    resultats["manifeste_lie"] = page.evaluate(
        "() => { const l = document.querySelector('link[rel=manifest]'); return l ? l.getAttribute('href') : null }"
    )
    ctx.close()
    return resultats


# --------------------------------------------------------------------------
# Entrée
# --------------------------------------------------------------------------


def main() -> None:
    cible = sys.argv[1] if len(sys.argv) > 1 else "tout"
    serveur = demarrer_serveur()
    try:
        with sync_playwright() as p:
            navigateur = p.chromium.launch()
            if cible in ("preuves", "tout"):
                generer_preuves(navigateur)
            if cible == "ecrans":
                capturer_ecrans(navigateur)
            if cible in ("captures", "tout"):
                capturer_ecrans(navigateur)
            if cible in ("invite", "captures", "tout"):
                capturer_invite(navigateur)
            if cible in ("horsligne", "captures", "tout"):
                capturer_hors_ligne(navigateur)
            if cible in ("pages", "captures", "tout"):
                capturer_pages(navigateur)
            if cible in ("mesures", "tout"):
                mesures = {
                    "invite_installation": mesurer_invite(navigateur),
                    "non_regression_bulle": mesurer_non_regression(navigateur),
                    "pwa": mesurer_pwa(navigateur),
                }
                chemin = DOSSIER / "mesures-invite-installation.json"
                chemin.write_text(json.dumps(mesures, indent=2, ensure_ascii=False), encoding="utf-8")
                print(f"  → {chemin.name}")
            navigateur.close()
    finally:
        serveur.shutdown()


if __name__ == "__main__":
    main()
