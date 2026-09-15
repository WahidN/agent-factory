# De centrale op een Raspberry Pi

Deze pagina beschrijft hoe je het park als vaste centrale draait op een Raspberry Pi, zodat je niet meer afhankelijk bent van een Mac die toevallig aanstaat.

## Wat je nodig hebt

- Een Raspberry Pi 4 of nieuwer, met 64 bits Raspberry Pi OS (Lite volstaat, je hebt geen desktop nodig).
- Een bedrade netwerkverbinding. Wifi kan, maar bedraad geeft minder gedoe met slaapstanden en zwakke signalen.
- Toegang tot het netwerk waar de Macs op zitten. Zie de sectie over het netwerk hieronder.

## Node installeren

Raspberry Pi OS heeft geen recente Node in zijn eigen repositories. Installeer een arm64 build via NodeSource of nvm:

```
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
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
