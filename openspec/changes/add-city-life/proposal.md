## Why

The city shows how things stand, but nothing marks the moment they change. A user crosses 1B tokens and the helicopter is simply there; nobody at the office notices. The wall screen sits still without someone at the mouse, the sky is noon all night, and colleagues have no way to react to each other in the park. This change adds the moments in between, so the city is worth watching and gives people something to talk about.

## What Changes

- The page detects events from the session stream it already gets: a user reaching a new ladder row, a new session, a project that two or more users now work in. The first snapshot after a (re)connect is a baseline and fires nothing.
- A milestone sets off fireworks above the user's HQ for about 4 seconds.
- A LED ticker next to Station Nijmegen rotates through the last five events in Dutch.
- Two or more users in the same project get a pipeline on posts between their lots, with flow when one of them is busy.
- The sky, the sun and the street lamps follow the time of day in Europe/Amsterdam. On Friday from 16:00 to 20:00 the terraces fill up.
- The camera flies to the latest event, or else from busy lot to busy lot, and pauses for 60 seconds when someone touches the camera.
- A scoreboard at the Goffert shows three records of right now: the longest running session, the most subagents and the busiest project.
- Clicking an HQ sends kudos: confetti on that HQ on every open page and a line on the ticker. The server accepts one message type from a viewer, validates it and rate limits it per socket.
- Review modes: the showcase emits an event every 4 seconds.

Not in this change: anything stored on the central, records of the whole day, per lamp behaviour, changes to the reporter wire format.

## Capabilities

### New Capabilities

None. All of it is part of the scene that `factory-scene` covers.

### Modified Capabilities

- `factory-scene`: new requirements "City events", "Milestone ceremony", "Ticker", "Collaboration links", "Day rhythm", "Tour", "Scoreboard" and "Kudos". Hovering stays as it is; the click on an HQ lives in "Kudos".

## Impact

- Web: new `web/city-feed.ts`, `web/text-board.ts`, `web/demo-events.ts`, `web/ceremony.ts`, `web/ticker.ts`, `web/collab-links.ts`, `web/daylight.ts`, `web/tour.ts`, `web/scoreboard.ts`; changes in `web/main.ts`, `web/scene.ts`, `web/palette.ts`, `web/street-life.ts`, `web/view-options.ts`, `web/tooltip.ts`, `web/message-logic.ts`, `web/hq.ts`.
- Server: new `server/kudos.ts`, a message handler for `/ws` in `server/index.ts`, one new message type each way in `server/types.ts`. `PROTOCOL` stays 3: reporters do not change.
- Docs: `README.md`.
