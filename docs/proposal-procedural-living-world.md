# Onderzoek en voorstel: een procedurele, levende wereld met een eigen ink-animestijl

Status: voorstel, nog niet implementeren  
Basis: PR #20 (`f86351a`)  
Werkbranch: `codex/procedural-anime-world-pr20`

## Samenvatting

PR #20 bevat al het grootste deel van de technische fundering voor een procedurele wereld: een vaste stadsstructuur, deterministische varianten per cel, wijkaccenten, LOD, instancing, verkeer, forensen, straatleven en evenementen. Het probleem is niet dat de wereld niet procedureel is, maar dat de regels nog te lokaal en de visuele taal nog te generiek zijn. Daardoor voelt het geheel als een verzameling verzorgde low-poly miniaturen in plaats van als één wereld met een uitgesproken identiteit.

Mijn voorstel is **Nijmegen Inkshift**: een originele grafische stijl die anime-toonshading combineert met selectieve donkere inktlijnen, sterke silhouetten, beperkte kleurbanden en een kleine hoeveelheid handgetekende textuur. De stijl leent de principes van graphic-novelrendering, maar kopieert geen specifieke game-assets of vormtaal.

De aanbevolen aanpak heeft drie sporen:

1. één centrale stijllaag voor materialen, licht, contouren, kleur en UI;
2. een hiërarchische wereldgrammatica met stabiele seeds op wereld-, wijk-, cel- en objectniveau;
3. activiteit die betekenis uit de agentsessies zichtbaar maakt, in plaats van willekeurige drukte toe te voegen.

Eerst bouwen we een kleine, schakelbare visual spike achter `?style=ink`. Pas na vergelijking van screenshots en frametijden rollen we de stijl over alle objectfamilies uit.

## Wat PR #20 nu al goed doet

De huidige code heeft vier bruikbare procedurele lagen:

- **Stadsniveau:** `city-plan.ts`, `plots.ts` en de Hilbert-curve bepalen de vaste structuur en vrije sessiecellen.
- **Wijk- en celniveau:** `district-style.ts`, `filler.ts`, `landmarks-*.ts` en `factory-style.ts` kiezen deterministische composities.
- **Activiteitsniveau:** `workers.ts`, `urban-mobility.ts`, `street-life.ts` en `city-events.ts` brengen beweging en tijdsafhankelijke bezetting.
- **Renderniveau:** `StaticBuilder`, `InstancedMesh`, de detailcap en de far-LOD houden de kosten begrensd.

Dit sluit goed aan bij PCG-onderzoek: procedurele content werkt het best wanneer generatie uit meerdere lagen bestaat en artistieke constraints bewaakt, in plaats van alleen willekeur toe te voegen. De bestaande code gebruikt vooral constructieve, regelgebaseerde generatie; dat is voor deze toepassing voorspelbaarder en beter testbaar dan ML-generatie.

## Waar de huidige wereld visueel stukloopt

De review van `/?mode=showcase&view=all` laat vijf concrete zwakke plekken zien:

1. **Er is geen dominante stijllaag.** Vrijwel alles gebruikt `MeshStandardMaterial` met `flatShading`. Dat maakt vormen helder, maar niet vanzelf grafisch of anime-achtig.
2. **Silhouetten zijn op afstand te vergelijkbaar.** Fabrieken hebben drie dakvarianten, maar de hoofdvolumes, dakranden en erven blijven sterk verwant.
3. **Kleur is beschrijvend, niet compositorisch.** Gras is groen, water blauw en wegen grijs, maar er is nog geen bewuste verhouding tussen basiskleuren, schaduwkleuren, inkt en semantische accenten.
4. **Levendigheid is verspreid maar niet geregisseerd.** Auto's, trein, boten, bezoekers en evenementen bewegen, maar vormen nog geen leesbare lokale verhalen rond een actieve agent of wijk.
5. **De overzichtsstand wordt druk door gelijk gewicht.** Gebouwen, props, labels en infrastructuur vragen tegelijk aandacht. Een goede inktstijl moet juist een duidelijke hiërarchie afdwingen.

Daarnaast is de stad grotendeels deterministisch, maar de wegtextuur in `palette.ts` gebruikt nog `Math.random()`. Daardoor is niet ieder visueel detail reproduceerbaar.

## Onderzoeksconclusies

### Procedurele werelden

Een overtuigende procedurele wereld heeft niet maximaal veel variatie nodig, maar **variatie binnen herkenbare regels**. De bruikbare opbouw voor deze codebase is:

```text
world seed
  -> stadsstructuur en routes
  -> wijkidentiteit en dichtheidsvelden
  -> cel-archetype en compositieregels
  -> gebouw- en propgrammatica
  -> toestand, tijd en lokale activiteit
  -> LOD- en renderrepresentatie
```

Elke laag krijgt een eigen afgeleide seed. Een nieuwe bank in een park mag daardoor niet ineens alle huizen in dezelfde cel veranderen. Regels produceren eerst een klein data-object; Three.js bouwt daarna pas geometrie. Dat maakt de generatie testbaar zonder WebGL en maakt later bewaren, vergelijken en debuggen eenvoudiger.

Belangrijke constraints zijn:

- wegen, spoor en rivier blijven harde ruimtelijke grenzen;
- landmarks winnen altijd van filler;
- sessiestatus en modeltier blijven op elke zoom leesbaar;
- aantallen props en bewegende objecten hebben vaste plafonds;
- varianten worden op silhouet, ritme, hoogte en kleur verdeeld, niet alleen op kleine decoratie.

### Graphic-novel- en anime-rendering

De relevante les van Borderlands is niet simpelweg "zet een zwarte outline aan". De art director beschrijft een combinatie van procedurele Sobel-contouren, geïnkte details en grafisch opgebouwde schaduwen. Three.js biedt zowel `MeshToonMaterial` met een gradient map als officiële outline- en Sobelvoorbeelden. Daarmee zijn de bouwstenen beschikbaar, maar ze moeten selectief worden ingezet.

Een outline rond ieder klein object zou in deze isometrische overview zwarte ruis geven. Daarom stel ik drie niveaus voor:

- **primaire contour:** donkere schermruimtelijn voor grote silhouetten en dieptesprongen;
- **secundaire inkt:** vooraf bepaalde gevel-, dak- en machineaccenten in geometrie of canvastexturen;
- **geen lijn:** kleine vegetatie, mensen en ver weg gelegen props worden vooral door kleurcontrast gelezen.

`OutlinePass` is bedoeld voor geselecteerde objecten en is bruikbaar voor hover/focus, maar niet automatisch de beste volledige-scèneoplossing. In de spike vergelijken we een half-resolution depth/normal Sobel-pass met selectieve outlines. Inverted-hull-outlines zijn minder aantrekkelijk: ze vermenigvuldigen geometrie en draw calls en botsen met de huidige instancingstrategie.

### Performance

De bestaande `InstancedMesh`- en merge-aanpak moet leidend blijven; Three.js documenteert instancing expliciet als middel om draw calls te verlagen. De nieuwe stijl mag dus geen uniek materiaal per object introduceren. Toonmaterialen, gradient maps en inkttexturen moeten gedeeld worden per materiaalfamilie. Dynamische status blijft instance data of een compacte uniform/attribute, zoals de huidige busy glow.

## Drie mogelijke richtingen

| Richting | Karakter | Leesbaarheid | Technisch risico | Advies |
|---|---|---:|---:|---|
| Schone anime-diorama | lichte kleuren, 3-4 toonbanden, dunne contour | hoog | laag | mooi, maar mogelijk te vriendelijk en generiek |
| Gritty graphic novel | zware zwarte lijn, hatching, vuil en hoog contrast | middel | hoog | krachtig, maar snel te druk op overzichtsniveau |
| **Nijmegen Inkshift** | heldere animevormen, selectieve inkt, warme industriële accenten | **hoog** | **middel** | **aanbevolen** |

## Voorgestelde art direction: Nijmegen Inkshift

### Kernwoorden

Grafisch, energiek, stedelijk, optimistisch, licht rebels, leesbaar op miniatuurschaal.

### Vormtaal

- Grote vormen zijn schoon en overdreven leesbaar; kleine details ondersteunen alleen het silhouet.
- Fabrieken krijgen duidelijke families: bijvoorbeeld **Forge**, **Stack**, **Arcade**, **Hangar**, **Lab** en **Monolith**. Elke familie varieert daklijn, hoogteverdeling, gevelritme, installaties en erfindeling.
- Landmarks behouden hun herkenbare hoofdvorm en krijgen een eigen inktaccent, geen extra willekeur.
- Bomen, voertuigen en mensen worden iets hoekiger en krijgen anime-achtige proportie-overdrijving: grotere kruinen, duidelijkere cabines, herkenbare kop/lichaamverhouding.

### Kleur en licht

- Basiswereld: diep petrolgroen, warm beton, blauwgroene Waal en gedempt asfalt.
- Lichtzijde: warm ivoor in plaats van puur wit.
- Schaduwband: koel paarsblauw, niet simpelweg een donkerdere basiskleur.
- Inkt: bijna zwart met een blauwe/paarse zweem (`#171827`), zodat de scène niet doodslaat.
- Agentaccenten blijven verzadigd en zijn de belangrijkste kleurpieken.
- Busy/idle/error krijgen naast kleur ook beweging en vorm, zodat status niet alleen van kleur afhankelijk is.

### Materialen

- 3 of 4 toonbanden via een kleine gedeelde gradient map.
- Zeer lage of geen metalness; glans alleen op water, glas, rails en machines.
- Canvastexturen voor beperkte hatching, slijtage en lijnwerk, met vaste seeds.
- GTAO terugschroeven zodra de inktlijnen voldoende diepte geven; anders wordt de combinatie modderig.

### UI

- Labels worden compacter, rechthoekiger en krijgen dezelfde inkt- en accenttokens als de wereld.
- Alleen labels met voldoende schermruimte worden tegelijk getoond; landmarks krijgen prioriteit en overlapvermijding.
- Hover gebruikt een heldere accentoutline via `OutlinePass` of een vergelijkbare selectieve pass; de wereldoutline blijft donker en subtieler.

## Hoe de wereld levendiger wordt zonder visuele ruis

Levendigheid moet uit oorzaak en gevolg komen. De sessies zijn daarvoor de bron.

### 1. Lokale activiteitssignatuur per fabriek

Elke fabriekfamilie krijgt twee of drie gebonden animaties. Voorbeelden: een lopende transportband, pulserende reactorring, bewegende kraan, ventilator, laadpoort of energiekabel. Busy versnelt of activeert de signatuur; idle brengt hem tot rust; foutstatus veroorzaakt een korte, duidelijke storing. Dit is betekenisvoller dan overal extra verkeer.

### 2. Agentverhalen in de openbare ruimte

- Forensen krijgen een doelcategorie: station, lunch, park, plein of bezoek aan een andere actieve fabriek.
- Kleine groepjes ontstaan bij gelijktijdige activiteit, maar worden uit vaste pools getrokken.
- Een afgeronde taak kan kort zichtbaar worden als levering, lichtgolf of vertrekkend voertuig.
- Subagents lezen als satellietactiviteit rond de hoofdfabriek, niet als extra willekeurige bevolking.

### 3. Wijkritmes

Wijken krijgen verschillende dichtheid, propkansen, verticale ritmes en activiteitspatronen. De benedenstad is compact en druk, Oost ritmisch en groen, Waalsprong opener en geometrischer, de stadsrand rustiger. Deze verschillen moeten al op silhouet zichtbaar zijn.

### 4. Tijd als compositielaag

Gebruik 3 of 4 vaste dagdelen, geen volledig continue simulatie. Per dagdeel veranderen lichtkleur, raamverdeling, bezoekerspools en enkele routegewichten. Dat is deterministisch, testbaar en goedkoper dan dynamisch weer. Weer kan later als afzonderlijke uitbreiding.

### 5. Zeldzame accenten

Een variant voelt bijzonder door gecontroleerde zeldzaamheid. Per wijk of 20 cellen mag bijvoorbeeld één hero-prop verschijnen: muurschildering, kraan, neonbord, daktuin of kunstwerk. De generator bewaakt afstand en herhaling.

## Technisch voorstel

### A. StyleProfile als centrale bron

Voeg een `StyleProfile` en `MaterialRegistry` toe met tokens voor palette, toonramp, roughness, inkt, emissie en outlinegewicht. `standard()` wordt een adapter in plaats van overal de definitieve materiaalkeuze. Dit voorkomt tientallen losstaande materialwijzigingen.

De grootste compatibiliteitsrisico's zijn `StaticBuilder.BAKED_MATERIAL` en de custom `onBeforeCompile`-busy glow in `instanced-lots.ts`. De spike moet die twee paden als eerste bewijzen.

### B. Wereldrecepten als data

Splits "kiezen" en "bouwen":

```ts
type CellRecipe = {
  archetype: string;
  massing: MassingRule[];
  facade: FacadeRule;
  props: PropRule[];
  activityAnchors: ActivityAnchor[];
};
```

Een pure functie maakt het recept uit seeds en constraints. Builders vertalen het recept naar merged of instanced geometry. Tests kunnen dan distributie, grenzen, determinisme en verboden overlap controleren.

### C. Domeingescheiden seeds

Gebruik afgeleide seeds zoals:

- `world:1944/layout`
- `cell:3,7/massing`
- `cell:3,7/facade`
- `cell:3,7/props`
- `cell:3,7/activity`

Hierdoor verandert een nieuwe propregel niet onbedoeld de gebouwmassa. Vervang ook de willekeur in de wegtextuur door vaste seeded noise.

### D. Outline-spike

Vergelijk in exact dezelfde showcase:

1. toonmaterialen zonder outline;
2. toonmaterialen plus half-resolution depth/normal Sobel;
3. toonmaterialen plus selectieve `OutlinePass` voor nabije/hero-objecten.

Meet frame time, draw calls, GPU-geheugen en leesbaarheid op overzichts- en detailzoom. De keuze wordt op metingen gemaakt, niet alleen op een mooi close-upbeeld.

## Gefaseerde implementatie

### Fase 0 — visual spike

- Voeg `?style=ink` toe zonder de standaardweergave te veranderen.
- Style alleen gras, weg, water, één fabriekfamilie, één landmark, voertuigen en mensen.
- Maak vaste screenshots op overview, middenzoom en detailzoom.
- Vergelijk de drie outlinevarianten en leg performance vast.

**Go/no-go:** de stijl is op alle drie zoomniveaus leesbaar, statusaccenten blijven dominant en de showcase blijft binnen het afgesproken performancebudget.

### Fase 1 — gedeelde stijllaag

- Introduceer `StyleProfile`, gedeelde toonramp en materiaalregistry.
- Migreer `StaticBuilder`, far LOD, water, infrastructuur en verlichting.
- Breng sceneachtergrond, fog, schaduwkleur en HTML-labels onder dezelfde tokens.
- Voeg visuele regressiescreenshots toe voor de showcase.

### Fase 2 — procedurele grammaticaslag

- Maak celrecepten en domeingescheiden seeds.
- Breid fabrieken uit van drie dakvarianten naar zes massingfamilies.
- Geef iedere wijk eigen regels voor massa, gevel, groen en zeldzame accenten.
- Test determinisme, grenzen, variantverdeling en overlap.

### Fase 3 — betekenisvolle levendigheid

- Voeg activity anchors en fabriekssignaturen toe.
- Verbind agentstatus, subagents en afrondingen met lokale animatie.
- Voeg doelgerichte forensen en kleine groepsvorming toe.
- Houd alle populaties in vaste instanced pools.

### Fase 4 — polish en uitrol

- Tune LOD-specifieke contourdikte en detaildichtheid.
- Los labeloverlap en spoorlijn-overdraw in de overview op.
- Controleer kleurcontrast en status zonder kleur.
- Maak `ink` pas de standaard na screenshot-, test- en performancevergelijking.

## Acceptatiecriteria

- Een screenshot zonder UI is herkenbaar als één consistente wereld, niet als losse low-poly assets.
- Fabriekfamilies zijn op middenzoom aan silhouet te onderscheiden.
- Busy, idle en foutstatus blijven in grijswaarden en voor kleurenblindheid onderscheidbaar.
- Zelfde seed en inputs leveren byte-stabiele recepten en visueel stabiele composities.
- Geen nieuwe materiaalinstantie per cel of object; gedeelde materialen blijven de norm.
- Far LOD behoudt dezelfde kleur- en silhouetidentiteit als detailed LOD.
- De gekozen outlinevariant voldoet aan een vooraf vastgelegde frame-timegrens op de showcase.
- Beweging heeft altijd een bron in sessiestatus, tijd, route of evenement.

## Besluit dat ik adviseer

Kies **Nijmegen Inkshift** en start met Fase 0. Bouw nog niet meteen alle objecten om. Een verticale slice door de hele renderketen geeft snel antwoord op de twee grootste onzekerheden: of de inktstijl op overzichtsniveau rustig genoeg blijft en of toonmaterialen/contouren samengaan met de huidige instancing en busy-glow.

Na akkoord op de spike kunnen Fase 1 en 2 grotendeels naast elkaar worden ontworpen, maar de uitrolvolgorde blijft: eerst centrale stijlarchitectuur, daarna assetfamilies. Anders ontstaat opnieuw een verzameling lokaal gestylede objecten zonder gemeenschappelijke taal.

## Bronnen

- [Three.js `MeshToonMaterial`](https://threejs.org/docs/pages/MeshToonMaterial.html) — toonshading en gradient maps.
- [Three.js `OutlinePass`](https://threejs.org/docs/pages/OutlinePass.html) — selectieve contouren en downsampling.
- [Three.js Sobel postprocessing example](https://threejs.org/examples/webgl_postprocessing_sobel.html) — schermruimte-edge-detectie.
- [Three.js `InstancedMesh`](https://threejs.org/docs/pages/InstancedMesh.html) — gedeelde geometrie/materialen met minder draw calls.
- [Hendrikx et al., *Procedural Content Generation for Games: A Survey*](https://atlarge-research.com/pdfs/2013-hendrikx-procedural.pdf) — taxonomie van procedurele methoden en contentlagen.
- [A Survey on the Procedural Generation of Virtual Worlds](https://www.mdpi.com/2414-4088/1/4/27) — overzicht van PCG voor complete virtuele werelden.
- [Borderlands 3 art-directorinterview](https://www.cookandbecker.com/en/article/224/borderlands-3-art-director-scott-kester-on-communicating-an-attitude.html) — Sobel-contouren, hatching en de bredere graphic-novelbenadering.
- [GDC-presentatie over de art-directionwissel van Borderlands](https://media.gdcvault.com/gdc10/slides/Martel_Brian_Borderlands_and_the_11th_Hour_Art_Change.pdf) — onderscheid tussen eenvoudige cel-shading en de uiteindelijke concept-artstijl.
