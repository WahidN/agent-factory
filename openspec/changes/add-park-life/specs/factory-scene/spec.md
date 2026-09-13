## MODIFIED Requirements

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
| idle | windows dark, no smoke or steam, forklift parked, searchlight off, no truck or moving cars on the road, no workers outside, hall slightly faded |
| busy, no tool running | windows glow, thin slow smoke from the chimney stacks, a truck and cars drive the roads around the lot, workers walk and work in the yard |
| editing or writing files | forklift carries pallets between the dock and the parked truck |
| running a shell command | chimney stack rims glow orange and smoke is fast and thick |
| reading or searching files | searchlight on the lattice tower turns on and sweeps its beam across the yard |
| any other tool | cooling tower releases steam |

#### Scenario: Agent goes idle
- **WHEN** a session's status becomes idle
- **THEN** its windows go dark, all machines stop, its truck and cars leave the road, and its workers walk back inside

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
- **THEN** its cooling tower releases steam

### Requirement: Hover details
Hovering a main hall or a warehouse SHALL show a tooltip with its name, status, and current tool with label. The tooltip SHALL NOT show the working folder.

#### Scenario: Hover busy factory
- **WHEN** the pointer is over a main hall whose agent is editing `page.tsx`
- **THEN** a tooltip shows the session name, `busy`, and `Edit page.tsx`, and no folder path

#### Scenario: Hover warehouse
- **WHEN** the pointer is over a subagent's warehouse
- **THEN** a tooltip shows the subagent name, status, and current tool, and no folder path

#### Scenario: Pointer leaves
- **WHEN** the pointer moves off all halls and warehouses
- **THEN** the tooltip is hidden

## ADDED Requirements

### Requirement: Traffic follows activity
While a session is busy, cars SHALL drive the roads around its lot together with its truck. The number of moving cars SHALL be 2 plus 1 for each busy subagent, with at most 6. Cars SHALL appear and disappear smoothly and SHALL NOT overlap each other or the truck on the same loop. Every yard SHALL also show 3 parked cars, whether the session is busy or idle.

#### Scenario: Busy lot without subagents
- **WHEN** a session is busy and has no busy subagents
- **THEN** 2 cars and 1 truck drive the roads around its lot

#### Scenario: Busy subagents add cars
- **WHEN** a busy session has 3 busy subagents
- **THEN** 5 cars drive the roads around its lot

#### Scenario: Many subagents
- **WHEN** a busy session has 6 busy subagents
- **THEN** 6 cars drive the roads around its lot

#### Scenario: Lot goes idle
- **WHEN** a session becomes idle
- **THEN** its moving cars shrink away, and its 3 parked cars stay in the yard

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
