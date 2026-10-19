from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from meteoweb.api import resolve_locale
from meteoweb.config import Settings
from meteoweb.main import create_app


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    (tmp_path / "index.html").write_text("<html>meteoweb</html>")
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


@pytest.mark.parametrize(
    ("cookie", "header", "expected"),
    [
        ("es", "en-US", "es"),
        (None, "ca-ES,ca;q=0.9,es;q=0.8,en;q=0.5", "es"),
        (None, "fr-FR,fr;q=0.9", "en"),
        ("fr", "", "en"),
    ],
)
def test_resolve_locale(cookie: str | None, header: str, expected: str) -> None:
    assert resolve_locale(cookie, header) == expected


def test_put_locale_sets_cookie_that_get_honours(client: TestClient) -> None:
    response = client.put("/api/v1/locale", json={"locale": "es"})

    assert response.json() == {"locale": "es"}
    got = client.get("/api/v1/locale", headers={"Accept-Language": "en"})
    assert got.json() == {"locale": "es"}


def test_put_locale_rejects_unknown(client: TestClient) -> None:
    assert client.put("/api/v1/locale", json={"locale": "fr"}).status_code == 422


def test_serves_frontend_and_hides_docs(client: TestClient) -> None:
    assert "meteoweb" in client.get("/").text
    assert client.get("/api/v1/docs").status_code == 404
    assert client.get("/api/v1/healthz").json() == {"status": "ok"}


def test_last_frame_is_404_until_one_is_stored(client: TestClient) -> None:
    assert client.get("/api/v1/stream/last").status_code == 404
    assert client.get("/api/v1/stream/last.jpg").status_code == 404
