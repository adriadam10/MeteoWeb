# Weathercloud

Weathercloud no tiene API pública para estaciones personales. MeteoWeb usa los mismos endpoints JSON que su propia página (`app.weathercloud.net/d<código>`), vistos el 19/10/2026. Si cambian, se rompe `backend/src/meteoweb/weathercloud.py` y los tests con los fixtures de `backend/tests/fixtures/` siguen pasando: hay que volver a capturarlos.

| Endpoint | Método | Qué devuelve |
|---|---|---|
| `/device/values?code=<código>` | GET con `X-Requested-With: XMLHttpRequest` | Lectura actual (`temp`, `hum`, `bar`, `wspd`, `rain`, `uvi`, `solarrad`…) y `epoch` |
| `/device/stats?code=<código>` | GET con el mismo header | `[epoch, valor]` actual y máximos y mínimos de día, mes y año por variable |
| `/device/evolution` | POST `device`, `variable`, `period` (`day`/`week`/`month`), `WEATHERCLOUD_CSRF_TOKEN` | Series agregadas por tramos (`samples`, `sum`, `min`, `max`, `total`) |

- Sin el header XHR, `values` y `stats` responden vacío.
- `evolution` necesita la cookie `PHPSESSID` y el token CSRF que trae el HTML de la página del dispositivo. Si responde error o vacío, el cliente abre sesión nueva y reintenta una vez.
- Ids de `variable`: 101 temperatura, 201 humedad, 701 presión, 541 viento, 801 lluvia (`total` por tramo), 1001 radiación solar, 1101 UV. La media es `sum / samples`.
- Tramos: 1 h en `day`, 6 h en `week` y 1 día en `month`.
- Unidades: viento en m/s (la UI lo pasa a km/h), presión en hPa y lluvia en mm.
- A veces el servidor no acepta la conexión. Hay timeout de conexión de 4 s con 2 reintentos, y la UI conserva el último dato bueno.
