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

#### Scenario: Lot goes idle
- **WHEN** a session becomes idle
- **THEN** the parked vehicles its token milestones added stay in the yard

#### Scenario: Machine sends no total
- **WHEN** a session comes from a machine that does not report a token total
- **THEN** its yard shows the bay lines and no extras

### Requirement: Milestone overview
The scene SHALL offer a button that opens a dialog listing the whole ladder. The dialog SHALL show one block per user in the park, with that user's token total and every row of the table in "Token milestones". A row at or below the total SHALL read as unlocked, and a row above it SHALL show how many tokens are still to go. Every row SHALL show an icon, the threshold and what the row adds. When the park shows one user, the dialog SHALL NOT show a name above the block.

#### Scenario: Open the overview
- **WHEN** the user presses the milestones button
- **THEN** a dialog opens with the ten rows of the ladder, each with an icon, its threshold and what it adds

#### Scenario: Unlocked and locked rows
- **WHEN** the park's only user has a total of 600M
- **THEN** the rows up to and including 500M read as unlocked, and the 750M row shows 150M to go

#### Scenario: Two users
- **WHEN** the park shows sessions of two users
- **THEN** the dialog shows one block per user, each with that user's name and total

#### Scenario: One user
- **WHEN** every session in the park is of the same user
- **THEN** the dialog shows one block with no name above it

#### Scenario: Empty park
- **WHEN** no session is listed
- **THEN** the dialog shows the whole ladder with every row locked

## MODIFIED Requirements

### Requirement: One factory per session
The scene SHALL show one industrial lot for each listed session, labeled with the session name. A lot SHALL contain a grey flat-roof main hall with window grids, rooftop vents, a loading dock, and a colored base stripe, inside a fenced asphalt yard with the lot's machines. Sessions that share a working folder SHALL share an accent color, used on the hall's base stripe, the dock door, and the name sign.

The hall and machines SHALL be sized by the session's model tier:

| Tier | Model | Hall | Machines |
|---|---|---|---|
| small | model id contains `haiku` | smaller footprint, 1 row of windows | 1 short stack, small cooling tower, searchlight on a short tower |
| medium | model id contains `sonnet`, any model not in this table, or no model yet | full footprint, 1 row of windows | 3 stacks, cooling tower, searchlight on a lattice tower |
| large | model id contains `opus` | full footprint, 2 rows of windows | 4 taller stacks, bigger cooling tower, taller lattice tower |
| huge | model id contains `fable` or `mythos` | full footprint, 3 rows of windows | 5 tall stacks, biggest cooling tower, tallest lattice tower |

The yard, fence, gate, dock door, hall door, bay lines, warehouse slots and worker routes SHALL be the same for every tier. A yard SHALL hold no parked vehicles unless "Token milestones" adds them. Every tier SHALL show every animation from "Animate by status and tool". When a session's model tier changes, its lot SHALL be rebuilt to the new tier in place, without sinking and without moving its warehouses.

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

### Requirement: Hover details
Hovering a main hall or a warehouse SHALL show a tooltip with its name, status, current tool with label, and model id. The model line SHALL be left out while the model is empty. When the pointer is over a main hall whose machine reports a token total, the tooltip SHALL also show that total in short form, for example `4.4B tokens`. The tooltip SHALL NOT show the working folder.

#### Scenario: Hover busy factory
- **WHEN** the pointer is over a main hall whose agent runs `claude-opus-5` and is editing `page.tsx`
- **THEN** a tooltip shows the session name, `busy`, `Edit page.tsx`, and `claude-opus-5`, and no folder path

#### Scenario: Hover hall shows tokens
- **WHEN** the pointer is over a main hall whose machine has a total of 4 430 000 000 tokens
- **THEN** the tooltip shows the line `4.4B tokens`

#### Scenario: Machine sends no total
- **WHEN** the pointer is over a main hall whose machine reports no token total
- **THEN** the tooltip shows no token line

#### Scenario: Hover warehouse
- **WHEN** the pointer is over a subagent's warehouse
- **THEN** a tooltip shows the subagent name, status, current tool, and model, and no folder path

#### Scenario: Model not known yet
- **WHEN** the pointer is over a hall whose session has no model yet
- **THEN** the tooltip shows name, status, and tool, and no model line

#### Scenario: Pointer leaves
- **WHEN** the pointer moves off all halls and warehouses
- **THEN** the tooltip is hidden
