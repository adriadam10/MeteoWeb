# Red y WebRTC

El HTML, la API y el WebSocket del vídeo van por HTTP(S), así que detrás de un proxy inverso pasan por el 443 (el proxy tiene que dejar pasar WebSocket). Lo único que va por otro camino es el **media de WebRTC**, que nunca viaja dentro de HTTP: el navegador lo pide directamente a go2rtc en `8555/udp` o `8555/tcp`.

## Qué modo sale según desde dónde se mira

| Desde | Modo | Por qué |
|---|---|---|
| La misma LAN (o una VPN hacia ella) | WebRTC | El candidato `WEBRTC_CANDIDATE` (IP LAN del host + 8555) es alcanzable |
| Internet, sin abrir puertos | MSE por el WebSocket (443) | WebRTC no conecta y el player se queda con MSE, que llega antes; 1-2 s más de latencia |
| Internet, con `8555` reenviado en el router | WebRTC | Hay que añadir el candidato `stun:8555` (IP pública detectada por STUN) |

Sin abrir nada funciona en todas partes: desde fuera solo se pierde algo de latencia.

## Alternativas que no se usan

- **UPnP**: go2rtc no lo implementa. Se podría abrir el puerto con un sidecar `upnpc`, pero eso deja que un contenedor abra puertos en el router, y no compensa para ganar un segundo de latencia.
- **443 para WebRTC**: si el 443/tcp lo ocupa el proxy inverso, no sirve: el ICE-TCP de WebRTC no es HTTP ni TLS, así que el proxy no puede repartirlo por SNI. El 443/udp suele estar libre, pero el reenvío tendría que ir al 8555 igualmente; para eso es más sencillo reenviar el 8555.
- **TURN** (coturn en un VPS): sería la opción si hiciera falta WebRTC desde redes que bloquean UDP.
