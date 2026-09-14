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
