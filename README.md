# MeteoWeb

Web con una cámara IP en directo junto a los datos de una estación meteorológica de Weathercloud.

- **Vídeo**: [go2rtc](https://github.com/AlexxIT/go2rtc) lee el RTSP de la cámara y lo sirve por WebRTC (latencia < 1 s), con MSE o HLS como respaldo. El navegador solo habla con MeteoWeb: el backend hace de proxy del WebSocket de go2rtc, cuya API no se publica.
- **Resiliencia**: el player se reconecta solo si se cae el WebSocket, si go2rtc da error o si la imagen se congela. Mientras la cámara está caída se ve la última imagen guardada (el backend guarda una cada minuto en `/data/last.jpg`) con su hora y un aviso de que está offline.
- **Tiempo**: tarjetas con los datos actuales y los máximos y mínimos del día, más gráficas de 24 h, 7 días y 30 días. Salen de los endpoints JSON no oficiales de Weathercloud (ver [docs/weathercloud.md](docs/weathercloud.md)), con caché de 1 minuto para los datos actuales y de 10 minutos para el histórico.
- **UI**: PWA instalable, modo claro u oscuro según el sistema, en inglés y castellano (cookie, si no `Accept-Language`).

## Estructura

| Ruta | Qué |
|---|---|
| `backend/` | FastAPI (Python 3.14, uv): API `/api/v1`, proxy de go2rtc, guardado del último fotograma y estáticos |
| `frontend/` | React 19 + Vite + TS + Tailwind 4, Chart.js, Lingui (`src/locales/*.po`) |
| `frontend/src/vendor/video-rtc.js` | Player de go2rtc v1.9.14 (MIT), sin modificar; se extiende en `components/meteo-stream.ts` |
| `design-system/meteoweb/MASTER.md` | Sistema de diseño (ui-ux-pro-max) |
| `compose.yaml` | Stack local: meteoweb + go2rtc |
| `docs/` | Weathercloud, red y WebRTC |

## Configuración (`.env`, ver `.env.example`)

| Variable | Quién la lee | Qué |
|---|---|---|
| `STREAM_URL` | go2rtc | RTSP de la cámara (secreto) |
| `WEATHERCLOUD_DEVICE` | meteoweb | Código numérico de la estación (`app.weathercloud.net/d<código>`) |
| `WEBRTC_CANDIDATE` | go2rtc | `IP_LAN:8555` que se anuncia para WebRTC |
| `GO2RTC_URL` | meteoweb | Por defecto `http://go2rtc:1984` |
| `FRAME_INTERVAL` | meteoweb | Segundos entre fotogramas guardados (60) |
| `DEBUG` | meteoweb | `true` publica Swagger en `/api/v1/docs` |

## Desarrollo

```sh
cp .env.example .env            # y rellenar STREAM_URL
docker compose up -d --build    # http://localhost:3000

# o por separado, con recarga:
cd backend && uv sync && WEATHERCLOUD_DEVICE=0000000000 GO2RTC_URL=http://localhost:1984 \
  uv run uvicorn --factory meteoweb.main:app --port 3000 --reload
cd frontend && bun install && bun run dev   # proxy de /api a :3000
```

Comprobaciones (las mismas que la CI):

```sh
cd backend && uv run ruff format --check . && uv run ruff check . && uv run pytest -q
cd frontend && bun run lint && bun run i18n:check && bun run test && bun run build
```

Textos nuevos: `bun run i18n:extract` y traducir en `src/locales/es.po` (sin entradas vacías ni `fuzzy`).

## Despliegue

- Cada push a `master` pasa la CI y publica `adriadam10/meteoweb:latest` y `:sha-<commit>` en Docker Hub (amd64 y arm64, con caché de capas de buildx en GitHub Actions).
- Dependabot actualiza a diario las actions, las imágenes base, go2rtc y las dependencias. Sus PR se aprueban y fusionan solas cuando pasa la CI, y después se relanza la CI de `master` para publicar la imagen.
- Para desplegar: `compose.yaml` con la imagen publicada en vez de `build:`, el `.env` al lado y un volumen persistente en `/data` (último fotograma). Detrás de un proxy inverso, este debe dejar pasar WebSocket (`/api/v1/stream/ws`).
