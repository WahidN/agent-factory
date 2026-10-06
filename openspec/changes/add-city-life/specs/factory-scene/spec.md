## ADDED Requirements

### Requirement: City events
The page SHALL derive events from the sessions it receives: a user whose highest machine total reaches a new row of the token ladder, a session id it has not seen before, and a project that goes from fewer than two distinct users to two or more. The first set of sessions after the page connects or reconnects SHALL be a baseline that produces no events. A milestone SHALL fire at most once per user and row for as long as the page is open, also when that user leaves and comes back, and also when two machines run under the same name. A user who first appears after the baseline SHALL start from the row they already have, without a milestone for it; only their session start produces an event.

#### Scenario: Reconnect
- **WHEN** the socket reconnects and the server sends a snapshot
- **THEN** no event fires

#### Scenario: New row
- **WHEN** a user's highest total crosses 1B while the page is open
- **THEN** one milestone event fires for that user

#### Scenario: User appears with tokens
- **WHEN** a user with a machine total on the 1B row first shows up after the baseline
- **THEN** only a session start fires, no milestone

### Requirement: Milestone ceremony
A milestone event SHALL set off fireworks above the user's HQ that end within about 4 seconds. At most three ceremonies SHALL play at once; a fourth replaces the oldest. A ceremony SHALL cost no draw calls once it has ended.

#### Scenario: Fireworks
- **WHEN** a milestone event fires for a user with an HQ on the park
- **THEN** fireworks rise above that HQ and are gone within 5 seconds

### Requirement: Ticker
A LED ticker next to Station Nijmegen SHALL rotate through the last five events, one every 4 seconds, as short Dutch lines, newest first. Without events it SHALL show a fixed line. The ticker SHALL only stand while the station is built.

#### Scenario: Milestone line
- **WHEN** `noor` reaches the 1B row
- **THEN** the ticker shows `noor haalt 1B tokens`

### Requirement: Collaboration links
Two or more distinct users with a session in the same project SHALL be joined by a pipeline on posts, from the oldest session of one user to the next, users in name order. The pipeline SHALL take the project's accent colour and SHALL show flow while one of its two sessions is busy. The scene SHALL draw at most 8 links, and a link SHALL follow its lots when the layout changes.

#### Scenario: Two users, one project
- **WHEN** `noor` and `sam` both run a session in `shop`
- **THEN** a pipeline joins their lots

### Requirement: Day rhythm
The sky colour, the sun, the hemisphere light and the glow of the street lamps SHALL follow the time of day in Europe/Amsterdam, with dusk between day and night. Daytime SHALL look as the scene did before this requirement. On Friday from 16:00 to 20:00 the terraces SHALL hold more tables and visitors, within their existing caps. `?clock=HH:MM` and `?weekday=1..7` SHALL fix the clock for review.

#### Scenario: Night
- **WHEN** the page opens with `?clock=23:00`
- **THEN** the sky is dark and the street lamps glow brighter than at noon

### Requirement: Tour
With `?tour` the camera SHALL move by itself: to the location of the latest event, held for 8 seconds, or else to the next busy lot every 12 seconds. Any pointer input on the canvas SHALL pause the tour for 60 seconds.

#### Scenario: Hands off
- **WHEN** the page opens with `?tour` and three lots are busy
- **THEN** the camera moves to one of them within 12 seconds

### Requirement: Scoreboard
A scoreboard at the Goffert SHALL show three records of right now: the longest running session with its user and duration, the user with the most subagents in one session (left out when nobody has any), and the project with the most sessions. Ties SHALL go by name. The records SHALL NOT be stored.

#### Scenario: Empty park
- **WHEN** no session is listed
- **THEN** the scoreboard shows `Nog geen wedstrijd`

### Requirement: Kudos
Clicking an HQ SHALL send kudos for that user to the server. A press that moves more than 5 pixels or lasts longer than 500 ms SHALL NOT count as a click, so rotating the camera never sends kudos. The server SHALL accept from a viewer only `{ "type": "kudos", "user": <name> }` of at most 256 bytes, for a user with a listed session, at most once per 2 seconds per socket, and SHALL close the socket on any other message. A valid kudos SHALL reach every open page, which shows confetti on that user's HQ and a line on the ticker. Pages SHALL ignore message types they do not know.

#### Scenario: Kudos on the wall
- **WHEN** someone clicks the HQ of `noor`
- **THEN** confetti falls on that HQ on every open page, the wall screen included

#### Scenario: Bad message
- **WHEN** a viewer sends anything other than a kudos message
- **THEN** the server closes that socket
