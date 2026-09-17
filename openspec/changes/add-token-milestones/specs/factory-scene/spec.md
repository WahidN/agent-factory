## ADDED Requirements

### Requirement: Token milestones
A lot SHALL show extras in its yard for the season token total of its session's machine, counted from the season start as the `agent-tracking` spec describes. The extras SHALL be cumulative: every row of the table at or below the total is shown.

| Tokens | Extra in the yard |
|---|---|
| 10M | bike rack with 3 bikes at the people door |
| 25M | 1st parked car in the car bays |
| 50M | 2nd parked car |
| 100M | 3rd parked car, and a flagpole with a flag in the accent colour by the gate |
| 250M | coffee cart and a picnic table along the walkway |
| 500M | the truck at the dock bay |
| 750M | 2 EV chargers and a sports car in the front left corner |
| 1B | helipad with a helicopter on the hall roof |
| 2.5B | wind turbine at the front left fence, blades turning |
| 5B | blimp in the accent colour tethered above the hall, bobbing |

With a total below 10M the yard SHALL hold no vehicles and no extras; the car bay lines and truck bay lines SHALL stay. The extras SHALL be the same on every model tier and SHALL NOT overlap the hall, the machines, the warehouse slots or the worker routes. When the total crosses a threshold, the lot SHALL be rebuilt in place, without sinking and without moving its warehouses. The wind turbine blades SHALL turn and the blimp SHALL bob whether the session is busy or idle.

#### Scenario: Empty yard
- **WHEN** a session's machine has a total of 0
- **THEN** its yard shows the bay lines and no vehicles, bikes or other extras

#### Scenario: First car
- **WHEN** a session's machine has a total of 30M
- **THEN** its yard shows the bike rack and 1 parked car, and nothing from the rows above 30M

#### Scenario: Middle of the ladder
- **WHEN** a session's machine has a total of 600M
- **THEN** its yard shows the bike rack, 3 parked cars, the flagpole, the coffee cart, the picnic table and the truck, and no EV chargers, sports car, helipad, turbine or blimp

#### Scenario: Full ladder
- **WHEN** a session's machine has a total of 5B or more
- **THEN** its yard shows every extra in the table, including the helicopter, the turning turbine and the bobbing blimp

#### Scenario: Threshold crossed while running
- **WHEN** a session's machine total goes from 99M to 101M
- **THEN** the 3rd car and the flagpole appear in its yard in place, the lot does not sink, and its warehouses stay where they were

#### Scenario: Two machines on a hub
- **WHEN** the park shows sessions from a machine with 2B tokens and a machine with 20M tokens
- **THEN** every lot of the first machine shows the helicopter, and every lot of the second shows only the bike rack

#### Scenario: Small tier
- **WHEN** a session runs `claude-haiku-4-5-20251001` on a machine with 1B tokens
- **THEN** its small lot shows the same extras as a huge lot would

## MODIFIED Requirements

### Requirement: One factory per session
The scene SHALL show one industrial lot for each listed session, labeled with the session name. A lot SHALL contain a grey flat-roof main hall with window grids, rooftop vents, a loading dock, and a colored base stripe, inside a fenced asphalt yard with the lot's machines. Sessions that share a folder name SHALL share an accent color, used on the hall's base stripe, the dock door, and the name sign. When the listed sessions come from more than one machine, every sign SHALL also show its session's machine name. When they all come from one machine, no sign SHALL show a machine name.

The hall and machines SHALL be sized by the session's model tier:

| Tier | Model | Hall | Machines |
|---|---|---|---|
| small | model id contains `haiku` | smaller footprint, 1 row of windows | 1 short stack, small cooling tower, searchlight on a short tower |
| medium | model id contains `sonnet`, any model not in this table, or no model yet | full footprint, 1 row of windows | 3 stacks, cooling tower, searchlight on a lattice tower |
| large | model id contains `opus` | full footprint, 2 rows of windows | 4 taller stacks, bigger cooling tower, taller lattice tower |
| huge | model id contains `fable` or `mythos` | full footprint, 3 rows of windows | 5 tall stacks, biggest cooling tower, tallest lattice tower |

The yard, fence, gate, dock door, hall door, bay lines, warehouse slots and worker routes SHALL be the same for every tier. Every tier SHALL show every animation from "Animate by status and tool". When a session's model tier changes, its lot SHALL be rebuilt to the new tier in place, without sinking and without moving its warehouses.

#### Scenario: Sessions shown on load
- **WHEN** the page connects and receives the session list
- **THEN** one lot per session appears, each with a sign showing the session name

#### Scenario: Same folder
- **WHEN** two sessions have the same folder name, on the same machine or on different machines
- **THEN** their lots use the same accent color

#### Scenario: Different folders
- **WHEN** two sessions have different folder names and the same model tier
- **THEN** their halls look the same apart from the accent color and name

#### Scenario: One machine
- **WHEN** every listed session comes from the same machine
- **THEN** no sign shows a machine name

#### Scenario: Second machine joins
- **WHEN** a session from a second machine is added to a park that showed one machine
- **THEN** every sign, including those already shown, shows its machine name

#### Scenario: Back to one machine
- **WHEN** the last session from the other machine is removed
- **THEN** the machine names disappear from the remaining signs

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

### Requirement: Animate by status and tool
A lot SHALL show its agent's status and current tool through animation, as follows:

| State | Animation |
|---|---|
| idle | windows dark, no smoke or steam, forklift parked, searchlight off, no vehicles from this lot on the roads, no workers outside, hall slightly faded |
| busy, no tool running | windows glow, thin slow smoke from the chimney stacks, slow steam from the cooling tower, its truck and one car per busy subagent drive the park roads, workers walk and work in the yard |
| editing or writing files | forklift carries pallets between the dock and the truck bay |
| running a shell command | chimney stack rims glow orange and smoke is fast and thick |
| reading or searching files | searchlight on the lattice tower turns on and sweeps its beam across the yard |
| any other tool | cooling tower steam is fast and thick |

#### Scenario: Agent goes idle
- **WHEN** a session's status becomes idle
- **THEN** its windows go dark, all machines stop, its truck and cars shrink away, and its workers walk back inside

#### Scenario: Agent runs a shell command
- **WHEN** a session's current tool is a shell command
- **THEN** its chimney stack rims glow and its stacks smoke fast and thick

#### Scenario: Agent edits a file
- **WHEN** a session's current tool edits or writes a file
- **THEN** its forklift moves pallets between the dock and the truck bay

#### Scenario: Agent searches
- **WHEN** a session's current tool reads or searches files
- **THEN** its searchlight turns on and sweeps

#### Scenario: Unknown tool
- **WHEN** a session's current tool is not in the table
- **THEN** its cooling tower steam is fast and thick

### Requirement: Traffic follows activity
An idle lot SHALL send nothing onto the park roads. A busy lot SHALL send its truck plus 1 car for each busy subagent, with at most 6 cars. Vehicles SHALL appear on the roads around their own lot and then drive all roads of the park, not only the roads around their lot. Every road SHALL have one lane per direction; vehicles SHALL keep to the right lane and take a random turn at each crossing, never a U-turn, so traffic drives in both directions. Vehicles SHALL appear and disappear smoothly and SHALL slow down and stop behind the vehicle ahead in their lane instead of overlapping it. A yard SHALL hold no parked vehicles unless "Token milestones" adds them.

#### Scenario: Busy lot without subagents
- **WHEN** a session is busy and has no busy subagents
- **THEN** its truck appears on the roads around its lot, and no cars

#### Scenario: Busy subagents add cars
- **WHEN** a busy session has 3 busy subagents
- **THEN** 3 of its cars drive the park roads

#### Scenario: Many subagents
- **WHEN** a busy session has 8 busy subagents
- **THEN** 6 of its cars drive the park roads

#### Scenario: Traffic reaches other lots
- **WHEN** a busy lot is next to an idle lot
- **THEN** the busy lot's truck and cars also drive the roads around the idle lot, in both directions

#### Scenario: No agent is busy
- **WHEN** every session is idle
- **THEN** no vehicles drive the park roads

#### Scenario: Vehicle catches up
- **WHEN** a faster vehicle comes up behind a slower one in the same lane
- **THEN** it slows down and keeps a gap instead of driving through it

#### Scenario: Lot goes idle
- **WHEN** a session becomes idle
- **THEN** its truck and its cars shrink away, and the parked vehicles its token milestones added stay in the yard

### Requirement: Hover details
Hovering a main hall or a warehouse SHALL show a tooltip with its name, status, current tool with label, and model id. The model line SHALL be left out while the model is empty. When the listed sessions come from more than one machine, the tooltip SHALL also show the machine name. When the pointer is over a main hall, the tooltip SHALL also show the machine's season token total in short form, for example `4.4B tokens`. The tooltip SHALL NOT show the working folder.

#### Scenario: Hover busy factory
- **WHEN** the pointer is over a main hall whose agent runs `claude-opus-5` and is editing `page.tsx`
- **THEN** a tooltip shows the session name, `busy`, `Edit page.tsx`, and `claude-opus-5`, and no folder path

#### Scenario: Hover hall shows tokens
- **WHEN** the pointer is over a main hall whose machine has a total of 4 430 000 000 tokens
- **THEN** the tooltip shows the line `4.4B tokens`

#### Scenario: Hover warehouse
- **WHEN** the pointer is over a subagent's warehouse
- **THEN** a tooltip shows the subagent name, status, current tool, and model, and no folder path and no token line

#### Scenario: Model not known yet
- **WHEN** the pointer is over a hall whose session has no model yet
- **THEN** the tooltip shows name, status, and tool, and no model line

#### Scenario: Hover in a park with two machines
- **WHEN** the park shows sessions from two machines and the pointer is over a hall or a warehouse
- **THEN** the tooltip also shows the machine name of that session

#### Scenario: Pointer leaves
- **WHEN** the pointer moves off all halls and warehouses
- **THEN** the tooltip is hidden
