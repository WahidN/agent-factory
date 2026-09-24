# factory-scene Specification

## Purpose
Turns the live agent state into a 3D low-poly town where each Claude Code session is a factory that animates while its agent works, so activity is readable at a glance.
## Requirements
### Requirement: One factory per session
The scene SHALL show one industrial lot for each listed session, labeled with the session name. A lot SHALL contain a grey flat-roof main hall with window grids, rooftop vents, a loading dock, and a colored base stripe, inside a fenced asphalt yard with the lot's machines. Sessions that share a working folder SHALL share an accent color, used on the hall's base stripe, the dock door, and the name sign.

The hall and machines SHALL be sized by the session's model tier:

| Tier | Model | Hall | Machines |
|---|---|---|---|
| small | model id contains `haiku` | smaller footprint, 1 row of windows | 1 short stack, small cooling tower, searchlight on a short tower |
| medium | model id contains `sonnet`, any model not in this table, or no model yet | full footprint, 1 row of windows | 3 stacks, cooling tower, searchlight on a lattice tower |
| large | model id contains `opus` | full footprint, 2 rows of windows | 4 taller stacks, bigger cooling tower, taller lattice tower |
| huge | model id contains `fable` or `mythos` | full footprint, 3 rows of windows | 5 tall stacks, biggest cooling tower, tallest lattice tower |

The yard, fence, gate, dock door, hall door, parked cars, warehouse slots and worker routes SHALL be the same for every tier. Every tier SHALL show every animation from "Animate by status and tool". When a session's model tier changes, its lot SHALL be rebuilt to the new tier in place, without sinking and without moving its warehouses.

#### Scenario: Sessions shown on load
- **WHEN** the page connects and receives the session list
- **THEN** one lot per session appears, each with a sign showing the session name

#### Scenario: Same folder
- **WHEN** two sessions have the same working folder
- **THEN** their lots use the same accent color

#### Scenario: Different folders
- **WHEN** two sessions have different working folders and the same model tier
- **THEN** their halls look the same apart from the accent color and name

#### Scenario: Small model
- **WHEN** a session's model id is `claude-haiku-4-5-20251001`
- **THEN** its lot has the small hall with 1 stack and the small cooling tower

#### Scenario: Big model
- **WHEN** a session's model id is `claude-fable-5-1`
- **THEN** its lot has the hall with 3 rows of windows, 5 stacks, and the biggest cooling tower

#### Scenario: Unknown model
- **WHEN** a session's model is empty or names a model not in the table
- **THEN** its lot has the medium hall and machines

#### Scenario: Model switch
- **WHEN** a session's model changes from `claude-sonnet-5` to `claude-opus-5`
- **THEN** its hall grows to 2 rows of windows and its machines change to the large set, while its warehouses stay in place and the lot does not sink

### Requirement: Stable lots
Each session's lot SHALL stay in the same place for as long as its session runs. Lots SHALL sit on a grid. Roads with lane markings, sidewalks, trees, and street lamps SHALL only be drawn around cells that have a lot; cells without a lot SHALL stay plain grass. A new session SHALL take a free lot without moving existing lots. Lots SHALL be filled in order of session start time.

#### Scenario: New session starts
- **WHEN** a new session appears while other lots are shown
- **THEN** the new lot appears on a free grid cell, roads extend to reach it, and no existing lot moves

#### Scenario: Session ends
- **WHEN** a session is removed
- **THEN** its lot's lights turn off and its buildings and machines sink into the ground over about 1 second, and the grid cell becomes free

#### Scenario: No filler blocks
- **WHEN** the park is shown with any number of lots
- **THEN** no forest or empty road blocks are drawn for cells without a lot

#### Scenario: Shared road stays
- **WHEN** one of two neighbouring lots is removed
- **THEN** the road between them stays, and the roads that only surrounded the removed lot disappear

### Requirement: Animate by status and tool
A lot SHALL show its agent's status and current tool through animation, as follows:

| State | Animation |
|---|---|
| idle | windows dark, no smoke or steam, forklift parked, searchlight off, sends 2 cars but no truck onto the roads, no workers outside, hall slightly faded |
| busy, no tool running | windows glow, thin slow smoke from the chimney stacks, slow steam from the cooling tower, its truck and cars drive the park roads, workers walk and work in the yard |
| editing or writing files | forklift carries pallets between the dock and the parked truck |
| running a shell command | chimney stack rims glow orange and smoke is fast and thick |
| reading or searching files | searchlight on the lattice tower turns on and sweeps its beam across the yard |
| any other tool | cooling tower steam is fast and thick |

#### Scenario: Agent goes idle
- **WHEN** a session's status becomes idle
- **THEN** its windows go dark, all machines stop, its truck and extra cars shrink away, and its workers walk back inside

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
Hovering a main hall or a warehouse SHALL show a tooltip with its name, status, current tool with label, and model id. The model line SHALL be left out while the model is empty. The tooltip SHALL NOT show the working folder.

#### Scenario: Hover busy factory
- **WHEN** the pointer is over a main hall whose agent runs `claude-opus-5` and is editing `page.tsx`
- **THEN** a tooltip shows the session name, `busy`, `Edit page.tsx`, and `claude-opus-5`, and no folder path

#### Scenario: Hover warehouse
- **WHEN** the pointer is over a subagent's warehouse
- **THEN** a tooltip shows the subagent name, status, current tool, and model, and no folder path

#### Scenario: Model not known yet
- **WHEN** the pointer is over a hall whose session has no model yet
- **THEN** the tooltip shows name, status, and tool, and no model line

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
- **THEN** a grey "reconnecting..." indicator is shown, the page retries every 2 seconds, and if no sessions were ever received the ground shows the hint `run pnpm dev`

#### Scenario: Server comes back
- **WHEN** the server becomes reachable again
- **THEN** the page reconnects without a reload and shows the current sessions

### Requirement: Traffic follows activity
Every session's lot SHALL send cars onto the park roads, busy or idle. An idle lot SHALL send 2 cars. A busy lot SHALL send 2 cars plus 1 for each busy subagent, with at most 6, and its truck. Vehicles SHALL appear on the roads around their own lot and then drive all roads of the park, not only the roads around their lot. Every road SHALL have one lane per direction; vehicles SHALL keep to the right lane and take a random turn at each crossing, never a U-turn, so traffic drives in both directions. Vehicles SHALL appear and disappear smoothly and SHALL slow down and stop behind the vehicle ahead in their lane instead of overlapping it. Every yard SHALL also show 3 parked cars, whether the session is busy or idle.

#### Scenario: Busy lot without subagents
- **WHEN** a session is busy and has no busy subagents
- **THEN** 2 cars and 1 truck appear on the roads around its lot

#### Scenario: Busy subagents add cars
- **WHEN** a busy session has 3 busy subagents
- **THEN** 5 of its cars drive the park roads

#### Scenario: Many subagents
- **WHEN** a busy session has 6 busy subagents
- **THEN** 6 of its cars drive the park roads

#### Scenario: Traffic reaches other lots
- **WHEN** a busy lot is next to an idle lot
- **THEN** the busy lot's truck and cars also drive the roads around the idle lot, in both directions

#### Scenario: No agent is busy
- **WHEN** every session is idle
- **THEN** each lot still sends 2 cars that drive the park roads, and no trucks drive

#### Scenario: Vehicle catches up
- **WHEN** a faster vehicle comes up behind a slower one in the same lane
- **THEN** it slows down and keeps a gap instead of driving through it

#### Scenario: Lot goes idle
- **WHEN** a session becomes idle
- **THEN** its truck and its cars for busy subagents shrink away, 2 of its cars keep driving, and its 3 parked cars stay in the yard

### Requirement: Workers
While a session is busy, small workers with hard hats and safety vests SHALL come out of the hall door and walk and work in its yard: 4 in the main yard, and 1 in front of each busy subagent warehouse. Workers SHALL walk along routes that do not cross buildings or machines and pause at each end of their route. When the session or subagent becomes idle, its workers SHALL walk back to their door and disappear.

#### Scenario: Lot becomes busy
- **WHEN** a session becomes busy
- **THEN** 4 workers appear at the hall door and walk to their places in the yard

#### Scenario: Busy subagent
- **WHEN** a subagent's warehouse is busy
- **THEN** 1 worker walks back and forth in front of that warehouse

#### Scenario: Lot goes idle
- **WHEN** a session becomes idle
- **THEN** its workers walk back to the hall door and disappear there

#### Scenario: Idle lot
- **WHEN** a session stays idle
- **THEN** no workers are visible in its yard

