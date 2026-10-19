"""What makes the site installable: a translated manifest, the
service worker at the root and the one page it keeps, `/offline`.

The worker (frontend/public/sw.js) caches nothing but that page: readings and video are
live, and the build's hashed assets are already kept by the HTTP cache.
"""

from functools import cache
from html import escape
from pathlib import Path

import polib
from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse

from meteoweb.api import LOCALE_COOKIE, resolve_locale

LOCALES_DIR = Path(__file__).with_name("locales")
# Same as --bg in frontend/src/index.css, light and dark.
BACKGROUND = {"light": "#f0f9ff", "dark": "#0b1220"}
THEME = "#0284c7"

router = APIRouter(include_in_schema=False)


@cache
def catalog(locale: str) -> dict[str, str]:
    """English is the source; other languages come from locales/<locale>.po."""
    path = LOCALES_DIR / f"{locale}.po"
    if not path.is_file():
        return {}
    return {e.msgid: e.msgstr for e in polib.pofile(str(path)) if e.translated()}


def locale_of(request: Request) -> str:
    return resolve_locale(
        request.cookies.get(LOCALE_COOKIE), request.headers.get("accept-language", "")
    )


def translator(locale: str):
    messages = catalog(locale)
    return lambda text: messages.get(text, text)


# Browsers fetch the manifest without cookies, and the worker stores /offline once:
# both vary by language, so caches must key on it.
VARY = {"Vary": "Accept-Language, Cookie"}


@router.get("/manifest.webmanifest")
async def manifest(request: Request) -> JSONResponse:
    locale = locale_of(request)
    _ = translator(locale)
    data = {
        "id": "/",
        "name": "MeteoWeb",
        "short_name": "MeteoWeb",
        "description": _("Live camera and weather station readings."),
        "lang": locale,
        "start_url": "/",
        "scope": "/",
        "display": "standalone",
        "theme_color": THEME,
        "background_color": BACKGROUND["dark"],
        "categories": ["weather"],
        "icons": [
            {"src": "/pwa-192x192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/pwa-512x512.png", "sizes": "512x512", "type": "image/png"},
            {
                "src": "/maskable-icon-512x512.png",
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "maskable",
            },
        ],
    }
    return JSONResponse(data, media_type="application/manifest+json", headers=VARY)


@router.get("/sw.js")
async def service_worker(request: Request):
    """From the build, but always revalidated so a new worker is picked up at once."""
    worker = request.app.state.settings.static_dir / "sw.js"
    if not worker.is_file():
        return PlainTextResponse("frontend not built", status_code=404)
    return FileResponse(worker, media_type="text/javascript", headers={"Cache-Control": "no-cache"})


OFFLINE_PAGE = """<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>{title} · MeteoWeb</title>
<style>
  :root {{ color-scheme: light dark; --bg: {light}; --fg: #0f172a; --muted: #475569; }}
  @media (prefers-color-scheme: dark) {{
    :root {{ --bg: {dark}; --fg: #e2e8f0; --muted: #94a3b8; }}
  }}
  body {{ margin: 0; min-height: 100dvh; display: grid; place-items: center; background: var(--bg);
         color: var(--fg); font: 16px/1.5 system-ui, sans-serif; text-align: center; }}
  main {{ max-width: 28rem; padding: 1.5rem; }}
  p {{ color: var(--muted); }}
  button {{ min-height: 44px; padding: 0 1.25rem; border: 0; border-radius: 999px; cursor: pointer;
           background: {theme}; color: #fff; font: inherit; font-weight: 600; }}
</style>
</head>
<body>
<main>
  <div aria-hidden="true" style="width:56px;margin:auto">{logo}</div>
  <h1>{title}</h1>
  <p>{body}</p>
  <button type="button" onclick="location.reload()">{retry}</button>
</main>
<script>
  // navigator.onLine stays true when only the server is unreachable, so ask it too.
  const retry = () => fetch("/api/v1/healthz", {{ cache: "no-store" }})
    .then((r) => r.ok && location.reload(), () => {{}});
  addEventListener("online", retry);
  setInterval(retry, 5000);
</script>
</body>
</html>
"""


@cache
def logo_svg(static_dir: Path) -> str:
    logo = static_dir / "logo.svg"
    return logo.read_text() if logo.is_file() else ""


@router.get("/offline")
async def offline(request: Request) -> HTMLResponse:
    """What the worker shows when a page can't load; it reloads itself once back online."""
    locale = locale_of(request)
    _ = translator(locale)
    html = OFFLINE_PAGE.format(
        lang=locale,
        title=escape(_("No connection")),
        body=escape(
            _(
                "MeteoWeb needs the network for the camera and the readings. "
                "This page reloads by itself when the connection comes back."
            )
        ),
        retry=escape(_("Try again")),
        # Inlined: the worker stores only this document, not the files it links to.
        logo=logo_svg(request.app.state.settings.static_dir),
        light=BACKGROUND["light"],
        dark=BACKGROUND["dark"],
        theme=THEME,
    )
    return HTMLResponse(html, headers=VARY | {"Content-Language": locale})
