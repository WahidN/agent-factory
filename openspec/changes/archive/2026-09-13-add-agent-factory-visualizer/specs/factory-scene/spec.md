## Purpose

Turns the live agent state into a 3D low-poly town where each Claude Code session is a factory that animates while its agent works, so activity is readable at a glance.

## ADDED Requirements

### Requirement: One factory per session
The scene SHALL show one factory for each listed session, labeled with the session name. Sessions that share a working folder SHALL share a roof color.

#### Scenario: Sessions shown on load
- **WHEN** the page connects and receives the session list
- **THEN** one factory per session appears, each with a sign showing the session name

#### Scenario: Same folder
- **WHEN** two sessions have the same working folder
- **THEN** their factories have the same roof color

### Requirement: Stable plots
Each factory SHALL stay on the same plot for as long as its session runs. A new session SHALL take a free plot without moving existing factories. Plots SHALL be filled in order of session start time.

#### Scenario: New session starts
- **WHEN** a new session appears while other factories are shown
- **THEN** the new factory appears on a free plot and no existing factory moves

#### Scenario: Session ends
- **WHEN** a session is removed
- **THEN** its factory turns its lights off and sinks into the ground over about 1 second, and its plot becomes free

### Requirement: Animate by status and tool
A factory SHALL show its agent's status and current tool through animation, as follows:

| State | Animation |
|---|---|
| idle | lights off, all machines still, building slightly faded |
| busy, no tool running | slow chimney smoke, windows glow |
| editing or writing files | robot arm swings and boxes move on the conveyor |
| running a shell command | furnace door glows orange and smoke is fast and thick |
| reading or searching files | roof radar dish turns |
| any other tool | wall gear spins |

#### Scenario: Agent goes idle
- **WHEN** a session's status becomes idle
- **THEN** its factory's lights turn off and all machines stop

#### Scenario: Agent runs a shell command
- **WHEN** a session's current tool is a shell command
- **THEN** its furnace door glows and its chimney smokes fast

#### Scenario: Unknown tool
- **WHEN** a session's current tool is not in the table
- **THEN** its wall gear spins

### Requirement: Short tool calls stay visible
Animations SHALL fade in and out over about 0.3 seconds, and a machine SHALL stay active for at least 0.6 seconds after its tool starts.

#### Scenario: Very short tool call
- **WHEN** a tool starts and finishes within 200 milliseconds
- **THEN** the matching machine is still visibly active for at least 0.6 seconds

### Requirement: Subagent workshops
Each subagent SHALL be shown as a small workshop on its parent factory's plot, joined by a short road, using the same animation rules. A plot SHALL show at most 4 workshops; any extra subagents SHALL be shown as a count on the parent's sign.

#### Scenario: Subagent appears
- **WHEN** a session gains a subagent
- **THEN** a small workshop grows in next to its factory

#### Scenario: Subagent removed
- **WHEN** a subagent is removed from its session
- **THEN** its workshop shrinks away

#### Scenario: More than 4 subagents
- **WHEN** a session has 6 subagents
- **THEN** 4 workshops are shown and the parent's sign shows a count of 2 more

### Requirement: Hover details
Hovering a factory or workshop SHALL show a tooltip with its name, working folder, status, and current tool with label.

#### Scenario: Hover busy factory
- **WHEN** the pointer is over a factory whose agent is editing `page.tsx`
- **THEN** a tooltip shows the session name, folder, `busy`, and `Edit page.tsx`

#### Scenario: Pointer leaves
- **WHEN** the pointer moves off all factories and workshops
- **THEN** the tooltip is hidden

### Requirement: Camera control
The user SHALL be able to rotate and zoom the view, and the camera SHALL NOT go below the ground.

#### Scenario: Rotate and zoom
- **WHEN** the user drags or scrolls on the scene
- **THEN** the view rotates or zooms and stays above the ground

### Requirement: Connection status
The page SHALL show whether it is connected to the server and SHALL retry every 2 seconds while disconnected.

#### Scenario: Connected
- **WHEN** the page is connected to the server
- **THEN** a green "live" indicator is shown

#### Scenario: Server not running
- **WHEN** the page cannot reach the server
- **THEN** a grey "reconnecting..." indicator is shown, the page retries every 2 seconds, and if no sessions were ever received the ground shows the hint `run npm run dev`

#### Scenario: Server comes back
- **WHEN** the server becomes reachable again
- **THEN** the page reconnects without a reload and shows the current sessions
