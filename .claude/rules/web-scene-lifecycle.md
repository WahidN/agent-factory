---
name: web-scene-lifecycle
description: Lots in de three.js-scene worden voortdurend gesloopt en herbouwd; waar invarianten horen, wat een uitgestelde teardown mag vrijgeven en welke resources gedeeld zijn.
globs: web/**/*.ts
---

# Lots worden voortdurend gesloopt en herbouwd

`redistribute()` in `web/main.ts` bouwt een verse `Lot` voor elke sessie die de detail-set binnenkomt en breekt de rest af. De frame-loop roept die functie rechtstreeks aan zodra de camera ver genoeg is gedreven, dus dit gebeurt bij elke pan en niet alleen bij een bericht van de server. Daar volgen drie regels uit.

**Zet een invariant in `redistribute()` zelf, niet bij één aanroeper.** Een verse `THREE.Group` is zichtbaar en staat verder op zijn defaults. Alles wat over elk lot moet gelden (filterzichtbaarheid, positie, de aan/uit-staat van een effect) hoort in de functie die het lot bouwt. Regel je het alleen in `handle()`, dan klopt het tot de camera beweegt en daarna niet meer.

**Een uitgestelde callback moet opnieuw kijken voor hij iets vrijgeeft.** `lot.remove(cb)` vuurt pas als de zak-animatie klaar is, ruim een seconde na de verwijdering. Dezelfde sessie-id kan dan alweer leven: een reporter die opnieuw verbindt laat de hub al zijn sessies vallen en meteen daarna terugsturen. Controleer in zo'n callback of de id nog in `sessions` staat voordat je gedeelde state teruggeeft, zoals `plots.release(id)`.

**Een `dispose()` per lot mag gedeelde resources niet aanraken.** De lettergeometrieen in `web/roof-sign.ts` en de materialen in `MATERIALS` worden één keer gebouwd en door elk lot getekend. De traversal in `Lot.disposeStructure()` loopt over alles wat in de groep hangt, dus een gedeelde mesh moet daar expliciet worden overgeslagen. Voeg je zo'n cache toe, markeer de meshes dan en pas de traversal aan in dezelfde wijziging; anders geeft het afbreken van één lot de buffers vrij van alle lots die er nog uit tekenen.
