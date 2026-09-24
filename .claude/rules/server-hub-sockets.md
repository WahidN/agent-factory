---
name: server-hub-sockets
description: Eén WebSocketServer draagt browsers op /ws en reporters op /relay; regels voor routeren, broadcasten en liveness op die sockets.
globs: server/**/*.ts
---

# Twee soorten clients op één WebSocketServer

`server/index.ts` accepteert browsers op `/ws` en reporters op `/relay` via dezelfde `wss`. Elke handler die je erbij schrijft moet dat onderscheid zelf maken; de socket zelf verraadt het niet.

**`wss.clients` is niet hetzelfde als "de browsers".** Wil je alleen browsers bereiken, houd dan een eigen set bij, gevuld in de connection-handler en geleegd op `close` (die vuurt ook na een `terminate()` uit de heartbeat). Broadcasten over `wss.clients` stuurt het hele park naar elke reporter, die het parseert en weggooit, en vermenigvuldigt het LAN-verkeer met het aantal Macs.

**Lees het pad in elke handler op dezelfde manier.** De upgrade-handler routeert op `request.url` met de querystring eraf. Vergelijkt een andere handler de kale `request.url`, dan komt `/relay?x=1` wel door de upgrade maar valt daarna in de browser-tak, waar een reporter nooit zijn hello stuurt en zijn machine dus nooit verschijnt. Gebruik één helper voor die vraag.

**De centrale draait weken onbeheerd op een Pi.** Twee dingen breken daardoor eerder dan in een dev-sessie. Een structuur die per bericht groeit begrens je bij het schrijven en niet pas bij het lezen, want niemand opent `/metrics`. En een lange verbinding heeft liveness aan beide kanten nodig: `ws` beantwoordt pings vanzelf, dus de kant die zelf niet pingt en nergens op let, merkt nooit dat de peer weg is en praat door in een gat.
