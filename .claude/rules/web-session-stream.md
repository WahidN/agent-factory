---
name: web-session-stream
description: Wat de sessiestroom van de hub wel en niet betekent voor code die er een overgang of een eerste meting uit afleidt; welke tussenstanden ruis zijn en hoe een detector daar overheen kijkt.
globs: web/**/*.ts
---

# De sessiestroom heeft tussenstanden die geen gebeurtenis zijn

Code die uit opeenvolgende sessiekaarten een overgang afleidt (iets nieuws, een drempel die gekruist wordt, de eerste stand van een gebruiker) kijkt naar een stroom met twee tussenstanden die op een wijziging lijken maar het niet zijn. Code die alleen de huidige stand tekent, zoals het scorebord of de pijpleidingen, heeft daar hooguit een flikker van. Een detector steekt er vuurwerk voor af.

**Een reporter die opnieuw verbindt laat zijn sessies verdwijnen en terugkomen.** De hub roept `hub.leave` aan zodra de relay-socket van een machine sluit en krijgt de sessies seconden later terug met dezelfde id's. Elke laptop die uit de slaapstand komt doet dit. Een detector die alleen de vorige kaart met de huidige vergelijkt ziet dan een project onder de twee gebruikers zakken en er weer boven komen, of een gebruiker vertrekken en terugkeren. Onthoud wat je al hebt aangekondigd (per gebruiker, per project, per sessie-id) en vergelijk daarmee, niet alleen met de vorige kaart. `CityFeed` in `web/city-feed.ts` doet dit voor alle drie zijn soorten; een nieuw soort gebeurtenis krijgt hetzelfde geheugen.

**`machineTokens` is 0 tot de scan van de reporter klaar is.** `publishTokens` in `server/index.ts` stuurt pas een totaal zodra alle transcripts gelezen zijn, en dan in één keer het volle bedrag. Een Mac die na het laden van de pagina online komt staat dus eerst op 0 en springt daarna naar zijn echte rij. Een 0 betekent "nog niet gemeten", niet "nul": leg een eerste stand pas vast bij het eerste totaal boven 0.

**Test de tussenstand, niet alleen de eindstand.** De tests die deze twee fouten hadden moeten vangen keken naar een gebruiker die meteen met zijn volle totaal binnenkwam en naar een project dat één keer samenwerking kreeg. Geef elke soort gebeurtenis een test met de reconnect-dip (weg en binnen één kaart terug) en, waar tokens meetellen, met 0 gevolgd door het echte totaal.
