import re
from pathlib import Path

import polib
import pytest
from fastapi.testclient import TestClient

from meteoweb import pwa
from meteoweb.config import Settings
from meteoweb.main import create_app


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    (tmp_path / "sw.js").write_text("// worker")
    settings = Settings(
        weathercloud_device="1",
        go2rtc_url="http://go2rtc.invalid:1984",
        stream_name="cam",
        static_dir=tmp_path,
        data_dir=tmp_path / "data",
        frame_interval=3600,
        debug=False,
    )
    with TestClient(create_app(settings)) as test_client:
        yield test_client


def test_manifest_follows_the_language(client: TestClient) -> None:
    es = client.get("/manifest.webmanifest", headers={"Accept-Language": "es-ES,es;q=0.9"})
    assert es.headers["content-type"] == "application/manifest+json"
    assert es.json()["lang"] == "es"
    assert es.json()["description"].startswith("Cámara")
    en = client.get("/manifest.webmanifest", headers={"Accept-Language": "en"})
    assert en.json()["description"].startswith("Live camera")
    assert any(icon.get("purpose") == "maskable" for icon in en.json()["icons"])


def test_offline_page_is_translated(client: TestClient) -> None:
    response = client.get("/offline", headers={"Accept-Language": "es"})
    assert response.headers["content-language"] == "es"
    assert "Sin conexión" in response.text
    assert '<html lang="es">' in response.text


def test_service_worker_is_served_from_the_root(client: TestClient) -> None:
    response = client.get("/sw.js")
    assert response.headers["content-type"].startswith("text/javascript")
    assert response.headers["cache-control"] == "no-cache"


def test_every_backend_string_is_translated() -> None:
    source = Path(pwa.__file__).read_text()
    used = {re.sub(r'"\s+"', "", m) for m in re.findall(r'_\(\s*((?:"[^"]*"\s*)+)\)', source)}
    used = {u.strip().strip('"') for u in used}
    catalog = {e.msgid: e for e in polib.pofile(str(pwa.LOCALES_DIR / "es.po"))}
    assert used, "no strings found"
    for text in used:
        entry = catalog.get(text)
        assert entry and entry.translated() and "fuzzy" not in entry.flags, text


def test_pages_say_their_language(client: TestClient, tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<html></html>")
    response = client.get("/", headers={"Accept-Language": "es"})
    assert response.headers["content-language"] == "es"
