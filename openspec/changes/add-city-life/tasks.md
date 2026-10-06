## 1. City feed and ticker

- [x] 1.1 `web/city-feed.ts`: detect milestone, session-start and collab-start, with a baseline after every (re)connect
- [x] 1.2 `web/text-board.ts`: canvas board with throttled repaint, and `landmarkPosition`
- [x] 1.3 `web/view-options.ts`: parse `tour`, `demo=events`, `clock` and `weekday`
- [x] 1.4 `web/demo-events.ts` and the showcase demo timer
- [x] 1.5 `web/ticker.ts` at Station Nijmegen, wired in `web/main.ts`

## 2. Milestone ceremony

- [x] 2.1 `web/ceremony.ts`: fireworks and confetti from a pool of three instanced shows
- [x] 2.2 `web/hq.ts`: expose roof and tint; wire the ceremony

## 3. Day rhythm

- [x] 3.1 `web/daylight.ts`: Amsterdam clock, sky, light, lamp glow and the Friday terrace boost
- [x] 3.2 `web/scene.ts` `setDaylight`, `web/palette.ts` `setLampGlow`, `web/street-life.ts` `setTerraceBoost`
- [x] 3.3 One clock source in `web/main.ts` that honours `?clock` and `?weekday`

## 4. Tour

- [x] 4.1 `web/tour.ts`: explicit tour state, event first, busy lots round robin, pause on input
- [x] 4.2 `web/scene.ts` `onUserInput`, and no snap back to the park centre during a tour

## 5. Collaboration links

- [x] 5.1 `web/collab-links.ts`: links per shared project, instanced pipes, posts and flow
- [x] 5.2 Update on session, layout and filter changes

## 6. Scoreboard

- [x] 6.1 `web/scoreboard.ts`: records of right now on a stadium board at the Goffert

## 7. Kudos

- [x] 7.1 `server/kudos.ts`: parse and rate limit viewer messages
- [x] 7.2 `/ws` message handler with a 1 KB frame cap, broadcast of valid kudos
- [x] 7.3 `web/message-logic.ts` `parseServerMessage`, `web/tooltip.ts` `onPick`, wiring in `web/main.ts`

## 8. Docs

- [x] 8.1 README: what the city shows, the viewer message, and the new review modes
