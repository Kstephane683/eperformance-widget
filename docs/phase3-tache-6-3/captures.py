#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Captures et mesures de la tâche 6.3 — console d'administration.

Ce script produit, dans ce dossier :

  · `avant-<écran>-<gabarit>-<thème>.png` — la console TELLE QU'ELLE ÉTAIT,
    servie depuis `dist-avant/` (build du commit précédent, reconstruit) ;
  · `apres-<écran>-<gabarit>-<thème>.png` — la console livrée, servie depuis
    `dist/` (build courant) ;
  · `mesures-interface.json` — ce que le moteur de rendu a réellement affiché :
    présence des clés d'agent internes dans le texte du document, emoji,
    nombre de modules atteignables, et empreinte MD5 de chaque image.

L'API est SIMULÉE (interception Playwright) : les captures ne dépendent ni du
réseau, ni d'un compte réel, et elles sont reproductibles à l'octet. Les jeux
d'essai contiennent VOLONTAIREMENT une clé d'agent interne (`sales-coach`) :
c'est ce que la console ne doit jamais montrer, et la mesure le vérifie sur le
document rendu — pas sur le code.

Le thème « avant » : la console était en sombre SEUL (exception documentée à
l'époque dans admin.html). Les captures claires de l'avant existent donc, mais
elles sont identiques aux sombres — c'est un RÉSULTAT, et le script le prouve
en comparant les empreintes MD5.

    python3 captures.py          # tout
    python3 captures.py apres    # la console livrée seulement
    python3 captures.py avant    # la console d'origine seulement
"""

from __future__ import annotations

import functools
import hashlib
import http.server
import json
import re
import socket
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright
from playwright.sync_api import Page

DEPOT = Path(__file__).resolve().parents[2]  # …/eperformance-widget
DOSSIER = Path(__file__).resolve().parent
PORT = 8106
BASE = f"http://127.0.0.1:{PORT}"

# Builds comparés — mêmes chemins relatifs que les autres harnais du dépôt
AVANT = "/docs/phase3-tache-6-3/dist-avant/admin.html"
APRES = "/dist/admin.html"

API = "https://web-production-4ab53.up.railway.app"
MOTIF_API = re.compile(r"^https://web-production-4ab53\.up\.railway\.app/.*")

GABARITS = {
    "mobile-390x844": (390, 844),
    "desktop-1440x900": (1440, 900),
}

# --------------------------------------------------------------------------
# Jeux d'essai — réalistes, et porteurs de la fuite à vérifier
# --------------------------------------------------------------------------

CONVERSATIONS = [
    {
        "conversation_id": "conv_9f31ac02",
        "site_id": "eperformance_vitrine",
        "status": "escalated",
        "human_active": False,
        "assigned_agent": "sales-coach",
        "lead_captured": True,
        "lead_name": "Awa Traoré",
        "lead_phone": "+225 01 51 17 06 66",
        "message_count": 6,
        "last_message": "Je vends des cosmétiques en ligne et je veux doubler mes commandes",
        "last_message_role": "user",
        "created_at": "2026-09-17T09:12:00Z",
        "last_message_at": "2026-09-18T09:04:00Z",
    },
    {
        "conversation_id": "conv_7c04b1de",
        "site_id": "eperformance_vitrine",
        "status": "escalated",
        "human_active": True,
        "assigned_agent": "closer-pro",
        "lead_captured": True,
        "lead_name": "Ibrahim Koné",
        "lead_phone": "+225 07 45 12 88 03",
        "message_count": 12,
        "last_message": "Parfait, je vous confirme pour vendredi",
        "last_message_role": "assistant",
        "created_at": "2026-09-16T14:20:00Z",
        "last_message_at": "2026-09-18T08:41:00Z",
    },
    {
        "conversation_id": "conv_2ad90f77",
        "site_id": "blog_eperformance",
        "status": "active",
        "human_active": False,
        "assigned_agent": None,
        "lead_captured": False,
        "lead_name": None,
        "lead_phone": None,
        "message_count": 4,
        "last_message": "Comment choisir entre SEO et publicité ?",
        "last_message_role": "user",
        "created_at": "2026-09-18T07:05:00Z",
        "last_message_at": "2026-09-18T07:08:00Z",
    },
    {
        "conversation_id": "conv_5b12e840",
        "site_id": "eperformance_vitrine",
        "status": "resolved",
        "human_active": False,
        "assigned_agent": None,
        "lead_captured": False,
        "lead_name": None,
        "lead_phone": None,
        "message_count": 3,
        "last_message": "Merci, c’est très clair",
        "last_message_role": "user",
        "created_at": "2026-09-15T11:00:00Z",
        "last_message_at": "2026-09-15T11:22:00Z",
    },
    {
        "conversation_id": "conv_4e77c1aa",
        "site_id": "blog_eperformance",
        "status": "abandoned",
        "human_active": False,
        "assigned_agent": None,
        "lead_captured": False,
        "lead_name": None,
        "lead_phone": None,
        "message_count": 1,
        "last_message": "Bonjour",
        "last_message_role": "user",
        "created_at": "2026-09-13T18:30:00Z",
        "last_message_at": "2026-09-13T18:30:00Z",
    },
]

DETAIL = {
    "conversation": {
        "conversation_id": "conv_9f31ac02",
        "site_id": "eperformance_vitrine",
        "status": "escalated",
        "human_active": False,
        "assigned_agent": "sales-coach",
        "created_at": "2026-09-17T09:12:00Z",
        "last_message_at": "2026-09-18T09:04:00Z",
    },
    "lead": {"name": "Awa Traoré", "email": "awa.traore@exemple.ci", "phone": "+225 01 51 17 06 66"},
    "messages": [
        {
            "id": 1,
            "role": "user",
            "content": "Bonjour, je vends des cosmétiques en ligne et je veux doubler mes commandes.",
            "human": False,
            "agent_used": None,
            "intent": None,
            "created_at": "2026-09-17T09:12:00Z",
        },
        {
            "id": 2,
            "role": "assistant",
            "content": (
                "Bonjour Awa. Pour doubler vos commandes, deux leviers comptent plus que les "
                "autres : la relance des paniers abandonnés et la preuve sociale sur vos pages "
                "produit. Souhaitez-vous que nous regardions votre tunnel actuel ?"
            ),
            "human": False,
            # Clé de routage interne : elle ne doit JAMAIS s'afficher
            "agent_used": "sales-coach",
            "intent": "ventes",
            "created_at": "2026-09-17T09:12:04Z",
        },
        {
            "id": 3,
            "role": "user",
            "content": "Oui, je veux bien. Je peux vous appeler demain matin.",
            "human": False,
            "agent_used": None,
            "intent": None,
            "created_at": "2026-09-18T09:02:00Z",
        },
        {
            "id": 4,
            "role": "assistant",
            "content": "Très bien. Un conseiller vous rappelle demain matin au +225 01 51 17 06 66.",
            "human": True,
            "agent_used": None,
            "intent": None,
            "created_at": "2026-09-18T09:04:00Z",
        },
    ],
}

STATS = {
    "conversations": 5,
    "conversations_en_attente": 2,
    "leads_chatbot": 2,
    "candidats": 3,
    "candidats_en_attente": 1,
    "users": 4,
}

UTILISATEURS = [
    {
        "id": 1,
        "email": "stephane@eperformance.pro",
        "nom": "Stéphane Ballo",
        "role": "admin",
        "is_active": True,
        "last_login": "2026-09-18T08:12:00Z",
        "created_at": "2026-01-04T08:00:00Z",
    },
    {
        "id": 2,
        "email": "conseiller@eperformance.pro",
        "nom": "Awa Traoré",
        "role": "lead",
        "is_active": True,
        "last_login": "2026-09-17T17:40:00Z",
        "created_at": "2026-03-11T09:30:00Z",
    },
    {
        "id": 3,
        "email": "communication@eperformance.pro",
        "nom": None,
        "role": "lead",
        "is_active": False,
        "last_login": None,
        "created_at": "2026-05-02T10:00:00Z",
    },
]

CANDIDATS = [
    {
        "id": 12,
        "nom": "Ibrahim Koné",
        "email": "ibrahim.kone@exemple.ci",
        "whatsapp": "+225 07 45 12 88 03",
        "entreprise": "Kone Conseil",
        "secteur": "Conseil B2B",
        "score": 82,
        "statut": "en_attente",
        "niveau_accompagnement": "acceleration",
        "created_at": "2026-09-15T09:00:00Z",
    },
    {
        "id": 13,
        "nom": "Mariam Diallo",
        "email": "mariam.diallo@exemple.ci",
        "whatsapp": None,
        "entreprise": "Atelier Diallo",
        "secteur": "Artisanat",
        "score": 58,
        "statut": "accepte",
        "niveau_accompagnement": "croissance",
        "created_at": "2026-09-12T14:10:00Z",
    },
    {
        "id": 14,
        "nom": "Yao Kouassi",
        "email": "yao.kouassi@exemple.ci",
        "whatsapp": "+225 05 11 22 33 44",
        "entreprise": None,
        "secteur": "Services numériques",
        "score": 34,
        "statut": "refuse",
        "niveau_accompagnement": "essentielle",
        "created_at": "2026-09-08T08:45:00Z",
    },
]

# Le client d'origine interrogeait GET /agents et affichait les clés : le jeu
# d'essai en porte, pour que l'« avant » montre la fuite et l'« après » son
# absence.
AGENTS = [
    {"key": "sales-coach", "label": "Coach commercial"},
    {"key": "closer-pro", "label": "Spécialiste closing"},
    {"key": "seo-expert", "label": "Expert SEO"},
]

# --------------------------------------------------------------------------
# Écrans
# --------------------------------------------------------------------------

# (nom, route à hash, sélecteur AVANT action, action, sélecteur APRÈS action)
ECRANS_APRES = [
    ("connexion", "#/login", ".ep-login__card", None, None),
    ("tableau-de-bord", "#/tableau-de-bord", ".adm-kpi", None, None),
    ("activite", "#/activite", ".adm-jour", None, None),
    ("performance", "#/performance", ".adm-graphe", None, None),
    ("conversations", "#/conversations", ".adm-boite__item", None, None),
    (
        "conversation-ouverte",
        "#/conversations",
        ".adm-boite__item",
        "clic",
        ".adm-boite__prospect",
    ),
    ("prospects", "#/prospects", ".adm-prospect", None, None),
    ("candidatures", "#/candidatures", ".adm-candidat__nom, .adm-grille", None, None),
    ("connaissances", "#/connaissances", ".adm-grille", None, None),
    ("publications", "#/publications", ".adm-article", None, None),
    ("competences", "#/competences", ".adm-competence", None, None),
    ("utilisateurs", "#/utilisateurs", ".adm-tableau", None, None),
    ("integrations", "#/integrations", ".adm-carte--lien", None, None),
    # Le tiroir mobile n'existe qu'en mobile : sa capture est restreinte au
    # gabarit mobile, sinon le bouton n'est pas affiché et le clic échoue.
    ("menu-mobile", "#/tableau-de-bord", ".adm-entete__burger", "clic", ".adm-barre--ouverte", ("mobile-390x844",)),
]

ECRANS_AVANT = [
    # L'écran de connexion de la console d'origine ne s'affichait PAS : son
    # App.vue utilisait `<LoginView>` sans l'importer, et Vue rendait un élément
    # inconnu `<loginview>` — page vide. C'est un défaut réel, corrigé par la
    # tâche 6.3 ; la capture le documente, donc le sélecteur attendu est
    # seulement le point de montage.
    ("connexion", "#/login", "#admin", None, None),
    ("chatbot", "#/chatbot", ".ep-adm__item", None, None),
    ("chatbot-conversation", "#/chatbot", ".ep-adm__item", "clic", ".ep-adm__lead-name"),
    ("utilisateurs", "#/users", ".users__table", None, None),
    ("candidats", "#/candidats", ".cand__card", None, None),
    ("crm", "#/crm", ".crm__card", None, None),
]

# URL de l'écran de connexion : sans jeton, la console affiche le formulaire.
ECRANS_SANS_JETON = {"connexion"}

TERMES_INTERNES = ["sales-coach", "closer-pro", "seo-expert", "Coach commercial", "Expert SEO"]

EMOJI = re.compile(
    "[\U0001f000-\U0001faff\u2190-\u21ff\u2600-\u27bf\u2b00-\u2bff\ufe0f\u200d]"
)


# --------------------------------------------------------------------------
# Serveur statique
# --------------------------------------------------------------------------


class ServeurSilencieux(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):  # type: ignore[override]
        pass


def demarrer_serveur() -> socketserver.ThreadingTCPServer:
    handler = functools.partial(ServeurSilencieux, directory=str(DEPOT))
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    serveur = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    return serveur


# --------------------------------------------------------------------------
# API simulée
# --------------------------------------------------------------------------


def repondre(route, donnees, status: int = 200) -> None:
    route.fulfill(
        status=status,
        content_type="application/json",
        body=json.dumps(donnees, ensure_ascii=False),
    )


def installer_api(page: Page) -> None:
    """Intercepte l'API : aucune requête ne sort, tout est déterministe."""

    def traiter(route) -> None:
        url = route.request.url
        chemin = url.replace(API, "")
        methode = route.request.method

        if methode == "POST":
            repondre(route, {}, 200)
            return
        if "/admin/stats" in chemin:
            repondre(route, STATS)
            return
        if re.search(r"/admin/conversations/[^/?]+$", chemin):
            repondre(route, DETAIL)
            return
        if "/admin/conversations" in chemin:
            repondre(route, {"conversations": CONVERSATIONS, "total": len(CONVERSATIONS)})
            return
        if "/admin/users" in chemin:
            repondre(route, {"users": UTILISATEURS, "total": len(UTILISATEURS)})
            return
        if "/admin/candidats" in chemin:
            repondre(route, {"candidats": CANDIDATS, "total": len(CANDIDATS)})
            return
        if chemin.endswith("/agents"):
            repondre(route, AGENTS)
            return
        repondre(route, {"detail": "non simulé"}, 404)

    page.route(MOTIF_API, traiter)


# --------------------------------------------------------------------------
# Préparation d'une page
# --------------------------------------------------------------------------

JETON = (
    # JWT factice : charge utile {email, nom, role} en base64url
    "eyJhbGciOiJIUzI1NiJ9."
    "eyJlbWFpbCI6InN0ZXBoYW5lQGVwZXJmb3JtYW5jZS5wcm8iLCJub20iOiJTdMOpcGhhbmUgQmFsbG8iLCJyb2xlIjoiYWRtaW4ifQ."
    "c2lnbmF0dXJl"
)


def preparer(page: Page, theme: str, jeton: bool) -> None:
    """Pose le thème de l'opérateur et, si besoin, le jeton, AVANT le chargement.

    Le script est en clair (chaîne JavaScript) : un `add_init_script` s'exécute
    avant tout script de la page, donc avant que Vue ne monte — c'est la seule
    façon de capturer un état authentifié sans jouer le formulaire de connexion,
    et de capturer le thème clair ou sombre de façon déterministe.
    """
    installer_api(page)
    valeur_theme = "dark" if theme == "sombre" else "light"
    amorce = [
        "try {",
        f"  window.localStorage.setItem('eperf-theme', '{valeur_theme}');",
    ]
    if jeton:
        amorce.append(f"  window.localStorage.setItem('eperf_admin_token', '{JETON}');")
    amorce.append("} catch (erreur) { /* stockage bloqué : thème système */ }")
    page.add_init_script("\n".join(amorce))


def capturer(
    page: Page,
    chemin: str,
    selecteur: str,
    action: str | None,
    selecteur_apres: str | None,
    cible: Path,
) -> dict:
    page.goto(f"{BASE}{chemin}", wait_until="domcontentloaded")
    page.wait_for_selector(selecteur, timeout=20_000)
    page.evaluate("document.fonts ? document.fonts.ready : null")

    if action == "clic" and selecteur_apres:
        # Un écran dont le contenu n'existe qu'après interaction (détail d'une
        # conversation) : on joue le geste, puis on attend l'état stable.
        page.click(selecteur)
        page.wait_for_selector(selecteur_apres, timeout=15_000)

    # Le temps que les transitions (--t) se posent : les captures doivent
    # montrer l'état stable, jamais une animation en cours.
    page.wait_for_timeout(450)
    page.screenshot(path=str(cible), animations="disabled")

    texte = page.inner_text("body")
    modules = page.eval_on_selector_all(
        "a.adm-lien", "noeuds => noeuds.map(n => n.dataset.module).filter(Boolean)"
    )
    # Entrées de la console D'ORIGINE (`.cockpit__link`) : la même question est
    # posée aux deux versions, la comparaison avant/après porte donc bien sur
    # le nombre de modules atteignables.
    modules_anciens = page.eval_on_selector_all(
        "a.cockpit__link", "noeuds => noeuds.map(n => n.textContent.trim())"
    )
    return {
        "image": cible.name,
        "md5": hashlib.md5(cible.read_bytes()).hexdigest(),
        "modules_atteignables": sorted(modules),
        "modules_anciens": sorted(modules_anciens),
        "termes_internes_presents": [t for t in TERMES_INTERNES if t in texte],
        "emoji_present": bool(EMOJI.search(texte)),
        "longueur_texte": len(texte),
    }


def jouer(etiquette: str, chemin_build: str, ecrans: list) -> dict:
    resultats: dict[str, dict] = {}
    with sync_playwright() as playwright:
        navigateur = playwright.chromium.launch()
        for gabarit, (largeur, hauteur) in GABARITS.items():
            for theme in ("clair", "sombre"):
                contexte = navigateur.new_context(
                    viewport={"width": largeur, "height": hauteur},
                    color_scheme="dark" if theme == "sombre" else "light",
                    device_scale_factor=1,
                    locale="fr-FR",
                )
                for ecran in ecrans:
                    nom, route, selecteur, action, selecteur_apres = ecran[:5]
                    gabarits_ecran = ecran[5] if len(ecran) > 5 else tuple(GABARITS)
                    if gabarit not in gabarits_ecran:
                        continue
                    cible = DOSSIER / f"{etiquette}-{nom}-{gabarit}-{theme}.png"
                    # Une PAGE par écran : le script d'amorçage (thème, jeton) ne
                    # s'applique qu'au chargement d'un document. Réutiliser la
                    # même page pour deux écrans donnerait, entre deux routes à
                    # hash, une simple navigation dans le même document — et le
                    # jeton posé après coup ne serait jamais lu par le store.
                    page = contexte.new_page()
                    preparer(page, theme, jeton=nom not in ECRANS_SANS_JETON)
                    try:
                        mesures = capturer(
                            page, f"{chemin_build}{route}", selecteur, action, selecteur_apres, cible
                        )
                    except Exception as erreur:  # noqa: BLE001 — on veut le nom de l'écran
                        page.screenshot(path=str(DOSSIER / f"echec-{etiquette}-{nom}-{gabarit}-{theme}.png"))
                        raise RuntimeError(
                            f"écran « {nom} » ({gabarit}, {theme}, {etiquette}) : {erreur}"
                        ) from erreur
                    mesures["gabarit"] = gabarit
                    mesures["theme"] = theme
                    mesures["ecran"] = nom
                    resultats[f"{nom}-{gabarit}-{theme}"] = mesures
                    print(f"  {etiquette} {nom} {gabarit} {theme} : ok", flush=True)
                    page.close()
                contexte.close()
        navigateur.close()
    return resultats


def main() -> int:
    quoi = sys.argv[1] if len(sys.argv) > 1 else "tout"
    serveur = demarrer_serveur()
    try:
        mesures: dict[str, object] = {}
        if quoi in {"tout", "apres"}:
            mesures["apres"] = jouer("apres", APRES, ECRANS_APRES)
        if quoi in {"tout", "avant"}:
            mesures["avant"] = jouer("avant", AVANT, ECRANS_AVANT)

        # Le thème clair de l'avant : mêmes images que le sombre ? On le prouve.
        if "avant" in mesures:
            doublons = []
            for cle, valeur in mesures["avant"].items():  # type: ignore[union-attr]
                if valeur["theme"] != "clair":
                    continue
                sombre = mesures["avant"][cle.replace("-clair", "-sombre")]  # type: ignore[index]
                if sombre["md5"] == valeur["md5"]:
                    doublons.append(valeur["image"])
            mesures["avant_themes_identiques"] = sorted(doublons)

        (DOSSIER / "mesures-interface.json").write_text(
            json.dumps(mesures, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

        for etiquette in ("avant", "apres"):
            if etiquette not in mesures:
                continue
            bloc = mesures[etiquette]
            fuites = [
                cle
                for cle, valeur in bloc.items()  # type: ignore[union-attr]
                if valeur["termes_internes_presents"]
            ]
            emojis = [cle for cle, valeur in bloc.items() if valeur["emoji_present"]]  # type: ignore[union-attr]
            print(
                f"{etiquette:6s} : {len(bloc)} captures — "  # type: ignore[arg-type]
                f"fuites d'agent : {len(fuites)}, emoji : {len(emojis)}"
            )
            for cle in fuites[:4]:
                print(f"    fuite dans {cle} : {bloc[cle]['termes_internes_presents']}")  # type: ignore[index]
        print(f"images écrites dans {DOSSIER}")
    finally:
        serveur.shutdown()
        try:
            serveur.server_close()
        except OSError:
            pass
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except socket.error as erreur:
        print(f"port occupé : {erreur}")
        raise SystemExit(1)
