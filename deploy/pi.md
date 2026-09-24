# De centrale op een Raspberry Pi

Deze pagina beschrijft hoe je het park als vaste centrale draait op een Raspberry Pi, zodat je niet meer afhankelijk bent van een Mac die toevallig aanstaat.

## Wat je nodig hebt

- Een Raspberry Pi 4 of nieuwer, met 64 bits Raspberry Pi OS (Lite volstaat, je hebt geen desktop nodig).
- Een bedrade netwerkverbinding. Wifi kan, maar bedraad geeft minder gedoe met slaapstanden en zwakke signalen.
- Toegang tot het netwerk waar de Macs op zitten. Zie de sectie over het netwerk hieronder.

## Node installeren

Raspberry Pi OS heeft geen recente Node in zijn eigen repositories. Installeer een arm64 build via NodeSource of nvm:

```
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
```

Controleer dat `node -v` een arm64 build meldt en niet stil terugvalt op iets ouds. Installeer daarna pnpm:

```
sudo npm install -g pnpm
```

## De repo uitchecken en bouwen

Hieronder staat overal `$USER`, het account dat je bij de eerste boot hebt
aangemaakt. Raspberry Pi OS levert sinds Bullseye geen standaard `pi` gebruiker
meer, dus die naam is bij jou waarschijnlijk iets anders.

```
git clone <repo-url> /home/$USER/agent-factory
cd /home/$USER/agent-factory
pnpm install
pnpm build
```

## De service plaatsen

Kopieer de unit uit deze repo naar systemd en schakel hem in:

Vervang eerst `USERNAME` in de unit door je eigen accountnaam, op twee plekken
(`User=` en `WorkingDirectory=`):

```
sudo cp deploy/agent-factory.service /etc/systemd/system/agent-factory.service
sudo sed -i "s/USERNAME/$USER/g" /etc/systemd/system/agent-factory.service
sudo systemctl daemon-reload
sudo systemctl enable --now agent-factory
```

De unit draait als je eigen gebruiker, niet als root, en start automatisch
opnieuw op als het proces stopt of de Pi herstart. `ExecStart` roept node
rechtstreeks aan in plaats van via pnpm, zodat systemd het echte serverproces
bewaakt en een stopsignaal daar aankomt en niet bij een tussenlaag.

## Avahi, zodat je geen IP-adres hoeft te onthouden

Raspberry Pi OS heeft Avahi meestal al aan boord. Controleer dat:

```
systemctl status avahi-daemon
```

Staat hij aan, dan is de Pi bereikbaar op `http://<hostnaam>.local:4317`. Zet de hostnaam expliciet zodat iedereen dezelfde naam gebruikt:

```
sudo raspi-config nonint do_hostname agentfactory
sudo reboot
```

Na de herstart is de centrale te vinden op `http://agentfactory.local:4317`, zonder DNS-invoer en zonder dat iemand een IP-adres hoeft op te zoeken.

## Logs begrenzen

Een SD-kaart gaat kapot van te veel schrijfacties. journald schrijft standaard alles weg zonder limiet, dus zet een grens in `/etc/systemd/journald.conf`:

```
[Journal]
Storage=volatile
RuntimeMaxUse=50M
```

`Storage=volatile` houdt de logs in RAM in plaats van op de SD-kaart; je verliest ze bij een herstart, wat voor deze service prima is. Herstart journald om de instelling te laten landen:

```
sudo systemctl restart systemd-journald
```

Wil je de logs toch op schijf, zet dan in elk geval `SystemMaxUse` op iets kleins (bijvoorbeeld 50M) in plaats van de grens open te laten.

## Het netwerk is de toegangscontrole

Er komt geen port forwarding op de router voor deze dienst. De centrale luistert op elk interface binnen het lokale netwerk, dus iedereen op dat netwerk kan de stream lezen. Zet de Pi daarom op hetzelfde netwerk als de Macs, en niet op een gastennetwerk: een gastennetwerk staat apart juist om apparaten van elkaar te scheiden, en dat zou de centrale onbereikbaar maken voor de Macs, of andersom net te bereikbaar voor gasten.

## Controleren dat het werkt

```
systemctl status agent-factory
curl http://localhost:4317/healthz
```

`systemctl status` moet `active (running)` tonen. De curl hoort een 200 terug te geven. Werkt dat, open dan `http://agentfactory.local:4317` vanaf een Mac op hetzelfde netwerk en controleer of de pagina laadt.

De Pi heeft geen Claude Code nodig. Staat er toch een `~/.claude/` op, dan toont de centrale die sessies ook; zonder die map start hij gewoon en kijkt hij elke 5 seconden of hij alsnog verschijnt.

## Een token instellen

Zonder token accepteert de centrale elke reporter die zich meldt. Met een token weigert hij een reporter die een ander token stuurt. Dat is een vangrail tegen een Mac die per ongeluk naar de verkeerde centrale wijst, geen beveiliging: het token gaat onversleuteld over `ws://` en de vergelijking is eenvoudig. Het netwerk blijft de echte toegangscontrole.

Zet het token met een override, zodat de unit uit de repo onaangeroerd blijft:

```
sudo systemctl edit agent-factory
```

Typ in de editor die opent:

```
[Service]
Environment=FACTORY_TOKEN=kies-een-token
```

Een extra `Environment=`-regel direct in `/etc/systemd/system/agent-factory.service` werkt ook. Laad daarna de configuratie opnieuw en herstart:

```
sudo systemctl daemon-reload
sudo systemctl restart agent-factory
```

Het token geldt alleen voor `/relay`; de pagina en `/ws` blijven voor elke browser open. Elke Mac moet daarna hetzelfde token invullen bij de vraag `Token` van `scripts/install.sh`. Een Mac met een oud of leeg token verschijnt niet meer, en het log van de centrale meldt dan `refused <machine>: bad token`.

## De Pi bijwerken

```
cd /home/$USER/agent-factory
git pull
pnpm install
pnpm build
sudo systemctl restart agent-factory
```

`pnpm build` is nodig omdat de centrale de pagina uit `web/dist` serveert. Na de herstart verbinden de Macs vanzelf opnieuw, met een willekeurige wachttijd tot 30 seconden.

### Volgorde als het protocol verandert

Een reporter stuurt bij het verbinden zijn protocolversie mee. De centrale accepteert een bereik, `MIN_PROTOCOL` tot `PROTOCOL` in `server/hub.ts`, en weigert alles daarbuiten. Vandaag is `PROTOCOL` 3 en `MIN_PROTOCOL` 2, dus de Pi accepteert een Mac op 2 en een Mac op 3.

Verhoogt een wijziging het protocol, kijk dan naar `MIN_PROTOCOL` in de nieuwe versie. Blijft die staan, dan accepteert de nieuwe centrale oude en nieuwe Macs: werk de Pi eerst bij en laat de Macs daarna in hun eigen tempo volgen. Gaat `MIN_PROTOCOL` mee omhoog, dan is er geen overlap, zoals bij de overstap van 1 naar 2. Werk dan eerst de Macs bij en direct daarna de Pi; tussen die twee stappen staat het park half leeg. Een Mac die de centrale niet begrijpt verdwijnt uit de stad: het log van de centrale toont `refused <machine>: protocol N, this hub accepts 2-3` en de Mac schrijft `relay: hub gone (1002 protocol 2-3 expected)` in zijn eigen log.

## Wie er verbonden is

```
curl http://agentfactory.local:4317/metrics
```

`/metrics` geeft `connected` (aantal reporters), `messagesPerSecond` (gemiddeld over de laatste 10 seconden) en per machine in `machines` de `machine`, de `protocol`-versie en `lastMessageAt` (tijdstempel in milliseconden).

```
curl http://agentfactory.local:4317/healthz
```

`/healthz` antwoordt altijd 200 zolang het proces draait, met drie velden: `mode` (hoort `central` te zijn), `reporters` en `lastUpdateAgeMs`, de milliseconden sinds de laatste sessiewijziging (`null` als er nog geen was). Een stil park en een vastgelopen park zien er in `lastUpdateAgeMs` hetzelfde uit, dus wie deze check gebruikt voor alarm beslist zelf wat te lang is.

## Logs lezen

```
journalctl -u agent-factory -f
```

Per reporter zie je `joined <machine> (protocol 3) from <ip>`, `left <machine>` of een `refused`-regel met de reden. Daartussen staat een regel per sessiewijziging.

## Als het niet werkt

| Wat je ziet | Waarschijnlijke oorzaak | Wat je doet |
| --- | --- | --- |
| `systemctl status` toont een herstartlus | `node_modules` ontbreekt, of `/usr/bin/node` bestaat niet | `pnpm install` in de checkout; controleer `which node` tegen `ExecStart` in de unit |
| Pagina toont "Not built yet" | `web/dist` ontbreekt | `pnpm build` en herstart de service |
| `agentfactory.local` is onbereikbaar, het IP-adres werkt wel | Avahi draait niet, of de hostnaam is anders | `systemctl status avahi-daemon`, en zet de hostnaam zoals hierboven |
| `mode` in `/healthz` is `local` | `--hub` ontbreekt in `ExecStart` | Vergelijk de unit met `deploy/agent-factory.service` |
| Een Mac verschijnt niet, er staat niets over hem in het log | De Mac bereikt de Pi niet: ander netwerk, gastennetwerk of verkeerd adres | Laat de eigenaar `reporter.out.log` op zijn Mac bekijken (zie de README) |
| `refused <machine>: bad token` | Token op de Mac wijkt af | De eigenaar draait `scripts/install.sh` opnieuw met het juiste token |
| `refused <machine>: protocol N` | Mac en Pi spreken een andere protocolversie | Werk de achterlopende kant bij |
