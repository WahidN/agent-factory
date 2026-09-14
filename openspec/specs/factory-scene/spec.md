# factory-scene Specification

## Purpose
Turns the live agent state into a 3D low-poly town where each Claude Code session is a factory that animates while its agent works, so activity is readable at a glance.

## Requirements

### Requirement: One factory per session
The scene SHALL show one industrial lot for each listed session, labeled with the session name. A lot SHALL contain a grey flat-roof main hall with window grids, rooftop vents, a loading dock, and a colored base stripe, inside a fenced asphalt yard with the lot's machines. Sessions that share a working folder SHALL share an accent color, used on the hall's base stripe, the dock door, and the name sign.

#### Scenario: Sessions shown on load
- **WHEN** the page connects and receives the session list
- **THEN** one lot per session appears, each with a sign showing the session name

#### Scenario: Same folder
- **WHEN** two sessions have the same working folder
- **THEN** their lots use the same accent color

#### Scenario: Different folders
- **WHEN** two sessions have different working folders
- **THEN** their halls look the same apart from the accent color and name

### Requirement: Stable lots
Each session's lot SHALL stay in the same place for as long as its session runs. Lots SHALL sit on a grid separated by roads with lane markings, with trees and street lamps along the roads. A new session SHALL take a free lot without moving existing lots. Lots SHALL be filled in order of session start time. Roads and trees SHALL extend to cover every lot in use.

#### Scenario: New session starts
- **WHEN** a new session appears while other lots are shown
- **THEN** the new lot appears on a free grid cell, roads extend to reach it, and no existing lot moves

#### Scenario: Session ends
- **WHEN** a session is removed
- **THEN** its lot's lights turn off and its buildings and machines sink into the ground over about 1 second, and the grid cell becomes free

### Requirement: Animate by status and tool
A lot SHALL show its agent's status and current tool through animation, as follows:

| State | Animation |
|---|---|
| idle | windows dark, no smoke or steam, forklift parked, searchlight off, no truck on the road, hall slightly faded |
| busy, no tool running | windows glow, thin slow smoke from the chimney stacks, slow steam from the cooling tower, a truck drives the roads around the lot |
| editing or writing files | forklift carries pallets between the dock and the parked truck |
| running a shell command | chimney stack rims glow orange and smoke is fast and thick |
| reading or searching files | searchlight on the lattice tower turns on and sweeps its beam across the yard |
| any other tool | cooling tower steam is fast and thick |

#### Scenario: Agent goes idle
- **WHEN** a session's status becomes idle
- **THEN** its windows go dark, all machines stop, and its truck leaves the road

#### Scenario: Agent runs a shell command
- **WHEN** a session's current tool is a shell command
- **THEN** its chimney stack rims glow and its stacks smoke fast and thick

#### Scenario: Agent edits a file
- **WHEN** a session's current tool edits or writes a file
- **THEN** its forklift moves pallets between the dock and the truck

#### Scenario: Agent searches
- **WHEN** a session's current tool reads or searches files
- **THEN** its searchlight turns on and sweeps

#### Scenario: Unknown tool
- **WHEN** a session's current tool is not in the table
- **THEN** its cooling tower steam is fast and thick

### Requirement: Short tool calls stay visible
Animations SHALL fade in and out over about 0.3 seconds, and a machine SHALL stay active for at least 0.6 seconds after its tool starts.

#### Scenario: Very short tool call
- **WHEN** a tool starts and finishes within 200 milliseconds
- **THEN** the matching machine is still visibly active for at least 0.6 seconds

### Requirement: Subagent warehouses
Each subagent SHALL be shown as a small grey warehouse inside its parent's yard. A warehouse SHALL show busy and idle through its windows, and its current tool through a small version of the lot animations: a small stack smokes for shell commands, its roller door opens and a pallet slides out for file edits, a rooftop lamp sweeps for reads and searches, and a rooftop fan spins for any other tool. A yard SHALL show at most 4 warehouses; any extra subagents SHALL be shown as a count on the parent's sign.

#### Scenario: Subagent appears
- **WHEN** a session gains a subagent
- **THEN** a small warehouse grows in inside its parent's yard

#### Scenario: Subagent removed
- **WHEN** a subagent is removed from its session
- **THEN** its warehouse shrinks away

#### Scenario: Subagent runs a shell command
- **WHEN** a subagent's current tool is a shell command
- **THEN** its warehouse's small stack smokes

#### Scenario: More than 4 subagents
- **WHEN** a session has 6 subagents
- **THEN** 4 warehouses are shown and the parent's sign shows a count of 2 more

### Requirement: Hover details
Hovering a main hall or a warehouse SHALL show a tooltip with its name, working folder, status, and current tool with label.

#### Scenario: Hover busy factory
- **WHEN** the pointer is over a main hall whose agent is editing `page.tsx`
- **THEN** a tooltip shows the session name, folder, `busy`, and `Edit page.tsx`

#### Scenario: Hover warehouse
- **WHEN** the pointer is over a subagent's warehouse
- **THEN** a tooltip shows the subagent name, folder, status, and current tool

#### Scenario: Pointer leaves
- **WHEN** the pointer moves off all halls and warehouses
- **THEN** the tooltip is hidden

### Requirement: Camera control
The scene SHALL open with an angled, isometric-style view with no perspective distortion, similar to the reference image. The user SHALL be able to rotate and zoom the view, and the camera SHALL NOT go below the ground.

#### Scenario: First load
- **WHEN** the page loads with sessions
- **THEN** the lots are shown from an angled overhead view where parallel edges stay parallel

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
