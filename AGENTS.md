# AGENTS.md

Web de cámara y estación meteo. Visión general, variables y comandos en `README.md`; esto son las reglas para el agente.

- Backend en `backend/` (uv, ruff, pytest) y frontend en `frontend/` (Bun, Biome, Lingui, vitest). Antes de dar algo por hecho, pasa las comprobaciones del README.
- Interfaz: sigue `design-system/meteoweb/MASTER.md`. Cada texto nuevo pasa por Lingui, con `bun run i18n:extract` y su traducción en `es.po`.
- `frontend/src/vendor/` es código de terceros (go2rtc): no se toca; lo propio se hace extendiendo `VideoRTC` en `components/meteo-stream.ts`.
- La API de Weathercloud no es oficial: cualquier cambio en `weathercloud.py` se prueba contra la web real y se actualizan `docs/weathercloud.md` y los fixtures.
- **Repo público**: aquí no entra nada de la infraestructura donde corre (IPs, hosts, dominios, rutas, códigos de dispositivo ni nombres de repos privados). Los ejemplos van con valores ficticios (`camera.lan`, `0000000000`). Lo del despliegue real vive en el repo privado de infraestructura.
- `git commit` y `git push`: pide permiso cada vez.
- Temporales en `scratchpad/` (gitignored).
