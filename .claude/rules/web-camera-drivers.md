---
name: web-camera-drivers
description: De camera in de scene heeft meerdere bestuurders (OrbitControls, focus() na een layoutwijziging, panTo(), de tour) die elkaar niet vanzelf horen; wat een nieuwe camerabeweging moet regelen en welke URL-beloftes uit de README gelden.
globs: web/**/*.ts
---

# De camera heeft meer dan één bestuurder

Vier dingen verplaatsen de camera: de gebruiker via OrbitControls, `focus()` in `web/scene.ts` na een layoutwijziging, `panTo()` voor een sprong naar een punt, en de tour in `web/tour.ts`, die om de zoveel seconden een kavel of een gebeurtenis opzoekt. Ze delen één orbit-target en weten niets van elkaar.

**De tour hoort alleen OrbitControls.** `onUserInput` vuurt op het `start`-event van de controls en nergens anders. Een camerabeweging die uit een gebruikersactie komt maar via `panTo()` loopt (een klik in een paneel, een sneltoets) pauzeert de tour dus niet; binnen twaalf seconden trekt de tour de camera weer weg en lijkt de klik kapot. Roep bij zo'n beweging zelf `tour.pauseForUser()` aan, in dezelfde wijziging als de `panTo()`.

**`?view=all` belooft het hele park in beeld.** De tabel "Reviewstanden" in de README is een contract: onder `?view=all` en `?mode=showcase&view=all` blijft de camera op het hele park, ook als het park groeit. In de code zijn dat twee aparte poorten: het hercentreren in `focus()` volgt `options.autoFit`, dat waar is voor `view=all` én voor de showcase, terwijl de tour alleen onder `view=all` uitstaat (`TOUR_ENABLED` in `web/main.ts`). De showcase houdt de tour, want daar wordt hij bekeken. Wie iets aan de camera verandert, loopt die tabel na en past in dezelfde PR of de code of de README aan. Een pan op park-zoom schuift de halve stad uit beeld.
