# syntax=docker/dockerfile:1
# MeteoWeb image: FastAPI backend serving the prebuilt React frontend.
# Built for amd64/arm64 by .github/workflows/ci.yml; locally: `docker compose build`.

# Static assets are platform independent: build them once on the host arch, never under QEMU.
FROM --platform=$BUILDPLATFORM oven/bun:1.4-slim AS frontend
WORKDIR /src
COPY frontend/package.json frontend/bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
COPY frontend/ ./
RUN bun run build

FROM python:3.14-slim AS backend
COPY --from=ghcr.io/astral-sh/uv:0.13 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=0
WORKDIR /app
# Dependencies first so code changes don't invalidate this layer.
COPY backend/pyproject.toml backend/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev --no-install-project
COPY backend/src ./src
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev --no-editable

FROM python:3.14-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" STATIC_DIR=/app/static DATA_DIR=/data
WORKDIR /app
COPY --from=backend /app/.venv ./.venv
COPY --from=frontend /src/dist ./static
# Last camera frame lives here; owned by the runtime user so a fresh volume is writable.
RUN mkdir /data && chown 65534:65534 /data
USER 65534:65534
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:3000/api/v1/healthz', timeout=4)"]
CMD ["uvicorn", "--factory", "meteoweb.main:app", "--host", "0.0.0.0", "--port", "3000", \
     "--proxy-headers", "--forwarded-allow-ips", "*", "--no-server-header"]
