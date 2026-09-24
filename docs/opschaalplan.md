# Van laptop naar centrale

> De handleidingen voor dagelijks gebruik staan in [`README.md`](../README.md) (meekijken en meedoen met je Mac) en [`deploy/pi.md`](../deploy/pi.md) (de centrale beheren).

Bouwplan, 15 september 2026. Eén Raspberry Pi op het kantoornetwerk draait het park van het hele team. Elke Mac stuurt zeven velden en verder niets. Niemand van buiten komt erbij, want er is niets om bij te komen. Het zware werk verschuift daarmee naar de scène: 150 fabrieken tekenen op 60 fps.

| | |
|---|---|
| Over de lijn | 7 velden |
| Per sessie | ~120 bytes |
| Bereikbaar | alleen LAN |
| Ontwerp op | 150 lots, test op 300 |
| Framebudget | 16,7 ms |
| Doorlooptijd | 10,5 tot 15,5 werkdagen |

## Uitgangspunten

Vier randvoorwaarden die de rest bepalen. Een voorstel dat er tegenin gaat hoort niet in dit plan, ook niet als het technisch aantrekkelijker is.

**Niets verlaat het kantoornetwerk.** Geen VPS, geen publiek domein, geen certificaat, geen port forwarding op de router. De Pi luistert op het LAN-interface en verder nergens. Gevolg: er komt geen auth-laag in de applicatie. Het netwerk is de toegangscontrole, niet de authenticatie. Zit het gastennetwerk niet apart, dan kijkt elke bezoeker mee; dat is het eerste om te controleren, en daarna jaarlijks.

**Zeven velden over de lijn.** Gebruiker, project en model, plus `status` (`"busy"` of `"idle"`), het aantal subagents, een id en de starttijd. De tool-naam en het tool-label gaan eruit, en daarmee precies het veld waar een bestandspad of een stuk commando in kon zitten. Gevolg: redactieniveaus zijn overbodig, het formaat zelf is de redactie. De scène verliest heftruck, zoeklicht en gloeiende schoorsteen, want die hingen aan `currentTool`. Wat overblijft is één busy-waarde per lot, en dat is precies de vorm die de instancing in fase 4 nodig heeft.

**De centrale is een Raspberry Pi.** De Pi tekent niets. Three.js draait in de browser van elke kijker; de Pi voegt JSON samen en serveert ongeveer een megabyte aan statische bestanden. Een Pi 4 met 2 GB volstaat ruim. Systemd in plaats van Docker, want voor één proces op één machine is dat simpeler en beter te debuggen.

**Altijd 60 fps.** Niet als gemiddelde maar als plafond van de frametijd. Het framebudget mag niet meegroeien met het park. Dat vraagt een harde bovengrens op het aantal volledig gedetailleerde lots, en dus een omslag van meshes per lot naar instanties per park.

Besluit: `/ws`, `/healthz` en `/metrics` hebben bewust geen authenticatie. De centrale is alleen op het LAN bereikbaar. `/ws` en `/healthz` geven niets prijs wat een browser in het park niet al ziet: gebruiker, project, model en status. `/metrics` toont daarnaast de machinenamen, en per machine de protocolversie en het tijdstip van het laatste bericht, wat op het LAN ook geen geheim is. Alleen `/relay` controleert een token, en dat is een vangrail tegen een verkeerd ingestelde reporter, geen toegangscontrole.

## Doelplaatje

```
kantoornetwerk ................................................
:                                                             :
:  30 Macs                 Raspberry Pi            kijkers    :
:  reporter, launchd  -->  node + systemd     -->  browser    :
:  leest ~/.claude         pagina + /ws            kantoor-   :
:                          :8080, bedraad          scherm     :
:                                                             :
:  7 velden, ws            http                               :
:.............................................................:
                                          X  internet: geen port forwarding
```

De Pi vervangt de hub op iemands MacBook en serveert daarnaast de pagina, zodat kijken geen repo en geen node_modules meer vraagt. De gestreepte lijn is de enige beveiliging die er is.

## Het wire-formaat

Dit is de hele wijziging aan `server/types.ts`. Subagents krijgen geen eigen objecten meer, alleen een telling.

Vandaag (ruim 350 bytes per sessie, meer met subagents):

```
id          "a3f9…"
name        "agent-factory opschalen"        <- weg
folder      "agent-factory"                  <- weg
machine     "dennispassway-macbook"          <- weg
status      "busy"
currentTool { name: "Bash", target: "…" }    <- weg
startedAt   1757923200000
model       "claude-opus-5"
subagents   [ { …alle velden hierboven… } ]  <- weg
```

Vanaf fase 2 (ongeveer 120 bytes, vast):

```
id          "a3f9…"
user        "dennis"
project     "agent-factory"
model       "claude-opus-5"
status      "busy"
subagents   2
startedAt   1757923200000
```

Waar de drie zichtbare velden landen: het bord in de voortuin toont de gebruiker (nu de sessienaam), de lichtbak op de gevel het project (nu de machine), de dakletters blijven het model. Zo draagt elk overgebleven veld een eigen fysiek object in de scène.

Redigeren gebeurt op de Mac, niet op de Pi. De reporter blijft de tool-events uit het transcript lezen, want daar leidt hij `status` uit af, maar ze verlaten de machine niet.

## Wat er vandaag in de weg staat

De reader en de tracker zijn in orde: pure modules, een tracker zonder eigen klok, tests met fixtures. De problemen zitten in de rand eromheen.

1. **De pagina bestaat alleen als dev-server.** Geen `build`-script, en de server start alleen een `WebSocketServer`, geen HTTP-server (`server/index.ts:38`). Wie het park wil zien draait `pnpm dev` met de repo op zijn eigen machine.
2. **De machinenaam is de identiteit, en die geef je zelf op.** Een spoke stuurt `hello` met een zelfgekozen `MACHINE`. Een tweede verbinding met dezelfde naam gooit de eerste eruit met `terminate()`, en een `close` verwijdert alle sessies van die naam (`server/index.ts:88-92`, `server/hub.ts:60-65`). De nieuwe `user` maakt een botsing waarschijnlijker dan een hostnaam.
3. **Geen hartslag op de verbindingen.** Relay en hub hebben geen ping/pong. Een dichtgeklapte MacBook laat een halfdode socket achter tot TCP het merkt. Reconnect is een vaste 2 seconden zonder jitter (`server/relay.ts:11`), dus na een herstart van de Pi komen dertig spokes tegelijk terug.
4. **Het park past niet in beeld, en de plek verschilt per kijker.** De fit-zoom rekent `120 / (half × 1,9)` en wordt geklemd op `minZoom 0,3` (`web/scene.ts:12`, `web/scene.ts:76-84`). Bij een raster van 7 bij 7, rond de 49 lots, is die grens bereikt. `PlotAllocator` deelt de eerste vrije index uit op volgorde van binnenkomst, in de browser (`web/plots.ts:9-20`), dus twee mensen zien een andere indeling.
5. **Geen linter, geen CI, geen dependency-check.** Typecheck en vitest zijn er. Biome, Knip, GitHub Actions en Dependabot ontbreken.

## 60 fps bij 150 fabrieken

Met afstellen lukt dit niet. Elke lot is nu een eigen verzameling meshes, en dat schaalt lineair mee met het aantal sessies.

Draw calls per lot, geteld uit de code (niet gemeten):

| Onderdeel | Per lot | Bij 150 lots | Waarom |
|---|---|---|---|
| Samengevoegde statische delen | 4 tot 6 | 600 tot 900 | StaticBuilder voegt per lot samen, niet over lots heen |
| Bord in de voortuin | 5 | 750 | losse meshes plus één eigen CanvasTexture |
| Lichtbak op de gevel | 3 | 450 | nog een CanvasTexture per lot |
| Dakletters | ~7 | ~1.050 | één TextGeometry per letter, per lot opnieuw gebouwd |
| Machines en verkeer | 8 tot 14 | 1.200 tot 2.100 | rook, stoom, werkers, voertuigen |
| Warehouses | 0 tot 20 | tot 3.000 | 4 per lot, elk met eigen meshes |
| **Totaal scènepass** | **~35** | **~5.000** | en de schaduwpass tekent hetzelfde nog een keer |
| Praktisch plafond op een MacBook | | 1.000 tot 2.000 | vuistregel voor WebGL op 60 fps, te bevestigen met een meting |

Een factor vijf tot tien te veel, voordat je de 300 CanvasTextures meetelt (samen makkelijk 200 MB videogeheugen) en de duizend TextGeometry-objecten bij het opbouwen.

Hoe je er wel komt, op volgorde van opbrengst:

1. **Instanties per model-tier in plaats van meshes per lot.** Vier hal-formaten, dus vier `InstancedMesh`-objecten met een matrix per lot, muurkleur via `setColorAt`, busy-waarde via een eigen `InstancedBufferAttribute` aangehaakt met `onBeforeCompile`. 150 hallen worden vier draw calls, en de gloed animeren is één buffer-upload per frame.
2. **Voeg samen per district, niet over het hele park.** Eén reuzenmesh sloopt frustum culling. Blokken van ongeveer vijf lots: weinig draw calls en nog steeds cullbaar bij inzoomen.
3. **Stop met de schaduwpass elk frame.** De zon staat vast en de gebouwen bewegen niet. `shadow.autoUpdate` uit, alleen opnieuw renderen bij een indelingswijziging of grote camerabeweging. De zon volgt nu `controls.target` (`web/scene.ts:112`); bij 150 lots verdeelt één 4096-map zich over ongeveer 900 eenheden, dus twee cascades rond de camera zijn waarschijnlijk het antwoord.
4. **Twee detailniveaus met een harde bovengrens.** Dichtbij het volledige lot, ver weg alleen hal, kleur en statuslicht. Herverdelen bij camerabeweging, niet per frame. Plafond op bijvoorbeeld twintig gedetailleerde lots, zodat het budget niet meegroeit met het park.
5. **Eén tekstatlas in plaats van 300 canvassen.** Alle borden in één textuur met een UV-offset per instantie. `TextGeometry` cachen per teken: hooguit dertig tekens en zes modelnamen.
6. **Post-processing op halve resolutie.** GTAO kost naar schermresolutie en is bij vier lots al het duurste van de frame. AO op de helft, `setPixelRatio` op 1,5.
7. **Het JavaScript per frame.** De tooltip bouwt elk frame alle pickables opnieuw op met een `flatMap` en raycast ertegen (`web/main.ts:104`, `web/tooltip.ts:40`). Cachen, alleen raycasten na `pointermove`, eerst een bounding box per district. Zelfde voor de verkeersarray.
8. **Meten voor en na elke stap.** Overlay achter `?stats` met `renderer.info.render.calls`, driehoeken en frametijd, tegen `scripts/fake-park.ts` met 150 en 300 lots.

Niet als uitgangspunt: three.js 0.186 heeft een WebGPU-renderer die het draw-call-plafond flink optilt, maar het vraagt een omzetting van de materialen en een browsercheck. Een halve dag onderzoek in fase 4, met WebGL als wat er hoe dan ook gebouwd wordt.

## Zes fasen

Elke fase is op zichzelf te mergen. Per fase eerst een OpenSpec change-proposal, daarna een PR van ongeveer 500 regels.

| Fase | Wat | Duur | Kan pas na |
|---|---|---|---|
| 00 | Kwaliteitsbasis | 0,5 dag | |
| 01 | Eén proces op de Pi | 1 tot 2 dagen | 00 |
| 02 | Minimaal wire-formaat | 1 dag | 00 |
| 03 | Verbindingen die een nacht overleven | 1 tot 2 dagen | 01 |
| 04 | 60 fps bij 150 fabrieken | 5 tot 8 dagen | 02 en 03 |
| 05 | Uitrol en beheer | 2 dagen | 02 |

### 00 Kwaliteitsbasis

Zonder poort in CI merk je een regressie pas als er een lot verkeerd staat in het park van dertig mensen.

| Bestand | Wijziging |
|---|---|
| `biome.json` (nieuw) | linter en formatter, bestaande stijl als uitgangspunt |
| `knip.json` (nieuw) | dode code en ongebruikte dependencies |
| `.github/workflows/ci.yml` (nieuw) | typecheck, test, lint, knip, diff-coverage op elke PR |
| `.github/dependabot.yml` (nieuw) | npm en github-actions |
| `package.json` | scripts `lint`, `format`, `knip`, `test:coverage` |

Geen coveragedrempel op `web/`; de diff-gate op 80% geldt voor `server/` en de pure modules in `web/` die al tests hebben.

Klaar wanneer een PR met een typefout in `server/types.ts` rood wordt zonder dat iemand kijkt.

### 01 Eén proces op de Pi

De server krijgt een echte `http.Server`, serveert de gebouwde pagina en mount de WebSocket op `/ws` van dezelfde poort.

| Bestand | Wijziging |
|---|---|
| `package.json` | `build` (vite build) en `start` |
| `server/index.ts` | `WebSocketServer({ noServer: true })`, upgrade-routing op `/ws` en `/relay`, statics uit `web/dist` |
| `server/config.ts` (nieuw) | env-vars op één plek, validatie, leesbare fout bij ontbreken |
| `server/health.ts` (nieuw) | `/healthz` met aantal verbonden reporters en leeftijd van de laatste update |
| `deploy/agent-factory.service` (nieuw) | systemd-unit met `Restart=always` |
| `deploy/pi.md` (nieuw) | Pi opzetten: 64-bits OS, Node arm64, Avahi, bedraad |
| `scripts/fake-park.ts` (nieuw) | N nepmachines die zich als spoke aanmelden en sessies verzinnen |

Meevaller: `web/main.ts:77` bouwt de socket-URL al uit `location.host`, dus same-origin serveren vraagt geen wijziging aan de client.

Pi-details: Pi 4 met 2 GB of Pi 5, 64-bits Raspberry Pi OS, bedraad. Avahi geeft `http://agentfactory.local:8080` zonder DNS-werk. Logs op `Storage=volatile` of begrensd, anders is een goedkope SD-kaart binnen een jaar stuk; een USB-SSD is beter als de Pi er permanent staat.

De healthcheck moet iets meten dat echt kan stukgaan: een Pi waar geen enkele reporter meer binnenkomt.

Klaar wanneer de Pi na een stroomstoring vanzelf opkomt met een werkend park op `agentfactory.local`, en `/healthz` `reporters: 0` meldt als je alle reporters stopt.

### 02 Minimaal wire-formaat

Van acht velden met geneste subagents naar zeven platte velden. De enige fase die het protocolnummer verhoogt.

| Bestand | Wijziging |
|---|---|
| `server/types.ts` | `AgentState` wordt `{ id, user, project, model, status, subagents, startedAt }` |
| `server/session-tracker.ts` | `currentTool` en `name` uit de state; subagents geteld, niet uitgestuurd |
| `server/index.ts` | `USER` uit de env in plaats van de hostnaam, gedeeld token in de `hello` |
| `server/hub.ts` | protocol naar 2, token controleren, gebruikersnaam uit de registratie |
| `web/lot.ts` | `TOOL_PARTS` en `partForTool` eruit; alleen nog busy/idle |
| `web/sign.ts` | bord toont de gebruiker |
| `web/light-box.ts` | lichtbak toont het project |
| `web/tooltip.ts` | tool-regel eruit |
| `web/warehouse.ts` | warehouses uit een aantal in plaats van uit een lijst |

De tracker bepaalt busy niet uitsluitend uit een open tool. Een sessie is busy als het sessiebestand dat zegt, als er een tool openstaat, of als het transcript in de laatste 5 seconden is beschreven (`SESSION_BUSY_MS`). Een subagent telt mee tot hij 60 seconden stil is zonder open tool (`SUBAGENT_REMOVE_MS`).

Protocol 1 en 2 kunnen niet naast elkaar. Rol de reporters uit voordat je de Pi omzet, of accepteer een middag waarin het park half leeg staat.

Klaar wanneer een `tcpdump` op de lijn niets anders laat zien dan die zeven velden, en de tooltip geen tool meer noemt.

### 03 Verbindingen die een nacht overleven

Dertig slapende MacBooks die tegelijk wakker worden is een ander regime dan vier laptops op één LAN. De doorvoer zelf is door het kleinere formaat geen probleem: 150 sessies van 120 bytes naar 30 kijkers is een paar honderd kilobyte per seconde.

| Bestand | Wijziging |
|---|---|
| `server/index.ts` | ping elke 30 s naar reporters en browsers, twee gemiste pongs is `terminate()` |
| `server/relay.ts` | exponentiële backoff met jitter, plafond 30 s |
| `server/hub.ts` | updates per tick bundelen in één `batch`-bericht |
| `server/types.ts` | `batch` in `ServerMessage` |
| `web/main.ts` | `batch` afhandelen, één `refocus()` per batch |
| `server/tests/` | faketimer-tests voor heartbeat, backoff en batching |

`refocus()` herbouwt alle wegen, stoepen, lantaarns en bomen van het park. Bij een snapshot van 150 sessies gebeurt dat nu 150 keer achter elkaar.

Klaar wanneer een spoke die acht uur sliep terugkomt zonder dubbele lots, en dertig gesimuleerde spokes na een herstart van de Pi gespreid terugkomen.

### 04 60 fps bij 150 fabrieken

Bouwvolgorde, met een meting aan het begin en na elke stap.

| Bestand | Wijziging |
|---|---|
| `web/stats.ts` (nieuw) | overlay achter `?stats`: draw calls, driehoeken, frametijd |
| `web/plots.ts` | plot-index afgeleid van gebruiker en sessie-id; een blok per gebruiker |
| `web/park-layout.ts` | districtsindeling en bounds |
| `web/instanced-lots.ts` (nieuw) | één InstancedMesh per model-tier, kleur en busy per instantie |
| `web/lot.ts` | wordt de gedetailleerde variant voor dichtbij |
| `web/lod.ts` (nieuw) | twee pools met een harde bovengrens op het aantal gedetailleerde lots |
| `web/scene.ts` | `shadow.autoUpdate` uit, cascades, AO op halve resolutie, `setPixelRatio` 1,5 |
| `web/roof-sign.ts` | `TextGeometry` cachen per teken |
| `web/sign.ts` | tekstatlas in plaats van een canvas per lot |
| `web/tooltip.ts` | pickables cachen, raycast alleen na `pointermove` |
| `web/filter.ts` (nieuw) | filteren op gebruiker, project en status, plus "spring naar mij" |

Een district per gebruiker verandert wat het park betekent: een straat met dertig terreinen. Zet een bord bij de ingang van elk blok in de stijl van de bestaande yard signs.

Dit is de enige fase die de look kan aantasten. Spreek vooraf af hoe ver weg het detail mag wegvallen.

Klaar wanneer de stats-overlay met 150 lots onder de 16,7 ms blijft op een MacBook en op het kantoorscherm, met een bovengrens die maakt dat 300 lots niet slechter presteert dan 150.

### 05 Uitrol en beheer

Dertig collega's gaan geen terminal met `pnpm dev` openhouden.

| Bestand | Wijziging |
|---|---|
| `scripts/install.sh` (nieuw) | naam en token vragen, launchd-plist schrijven, laden, één regel om te stoppen |
| `deploy/agent-factory.plist` (nieuw) | template met `KeepAlive` en logpad |
| `server/index.ts` | reporter-modus start geen HTTP-server en geen statische map |
| `server/hub.ts` | protocol-onderhandeling: accepteer een bereik, log welke versie een machine spreekt |
| `server/metrics.ts` (nieuw) | verbonden machines, berichten per seconde, laatste update per machine |
| `README.md` | meedoen in één commando, stoppen in één commando |

Je kunt dertig Macs niet tegelijk updaten. Laat achterlopende versies binnen en geef ze een merkteken.

Klaar wanneer een collega in één commando meedoet, in één commando stopt, en na een herstart van zijn Mac vanzelf weer in het park verschijnt.

## Buiten scope

- Geen bereikbaarheid van buiten: geen VPN, geen Tailscale, geen port forwarding, geen certificaat.
- Geen historie en geen database. De Pi houdt alles in geheugen.
- Geen herontwerp van de look. `machines.ts`, `palette.ts` en de vormen van de gebouwen blijven.
- Geen framework voor de pagina.
- Geen wijziging aan `claude-reader.ts` en de tail-logica.
- Geen cloud-sessies van claude.ai/code.

## De eerste stap

1. Dennis is collaborator op `WahidN/agent-factory`. Gestapelde PR's per fase direct in die repo, elke PR met de vorige fase-branch als base.
2. Fase 0 als eerste PR: klein, raakt geen gedrag, maakt elke volgende PR beoordeelbaar.
3. De Pi klaarzetten: 64-bits Raspberry Pi OS, bedraad, Avahi, Node arm64. Hoeft niet te wachten op code.
4. Daarna fase 1, want die levert `scripts/fake-park.ts` op. Zonder 150 verzonnen lots is fase 3 en 4 niet aantoonbaar.

---

Geteld op commit b57cf80. Draw calls zijn geteld uit de code, niet gemeten; de eerste taak van fase 4 is die telling vervangen door `renderer.info.render.calls`. De zoomgrens komt uit `VIEW_HEIGHT 120`, `PLOT_SIZE 60` en `minZoom 0,3`.
