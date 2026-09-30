## ADDED Requirements

### Requirement: User HQ
The scene SHALL show one HQ for every user with at least one listed session. An HQ SHALL stand on a plot of its own, the first plot of that user's run, so it sits next to that user's lots and is served by the same roads, sidewalks, lamps and trees. A user with no listed sessions SHALL have no HQ, and its plot SHALL go back to the city.

An HQ SHALL be an office tower on a forecourt, in the same wall tint the user's halls use, and SHALL show the user's name in letters on its roof. Its height SHALL follow the ladder in "Token milestones": a ground floor while the total is below the first row, and one extra floor for every row at or below the total, so a total of 5B gives a tower of eleven floors. The total SHALL be the highest machine total among that user's sessions, the same number the milestone overview shows for that user.

An HQ SHALL carry the four rows of the ladder that a yard does not hold: the flagpole, the helipad with the helicopter on the tower roof, the wind turbine on the HQ plot, and the blimp tethered above the tower. The turbine blades SHALL turn and the blimp SHALL bob whether the user's sessions are busy or idle.

Hovering an HQ SHALL show a tooltip with the user's name, that it is a head office, how many sessions that user has on the park, and that user's token total in short form. The count SHALL be every session of that user, whatever the filter shows. Only the tower SHALL answer the pointer: the plaza, the lawns and the planters around it SHALL NOT.

When a user's total crosses a row, its HQ SHALL be rebuilt in place, without sinking. An HQ SHALL rise out of the ground and sink back the way a lot does. When the filter hides a user, that user's HQ SHALL be hidden with that user's lots.

#### Scenario: First session of a user
- **WHEN** a user's first session appears
- **THEN** an HQ rises on the plot in front of that user's lots

#### Scenario: Last session of a user ends
- **WHEN** a user's last session is removed
- **THEN** its HQ sinks into the ground and its plot is free again

#### Scenario: Whose HQ it is
- **WHEN** the park shows an HQ of the user `noor`
- **THEN** its roof spells `NOOR`

#### Scenario: Empty ladder
- **WHEN** a user's total is 0
- **THEN** its HQ is a one floor office with no flagpole, helipad, turbine or blimp

#### Scenario: Half the ladder
- **WHEN** a user's total is 600M
- **THEN** its HQ is seven floors tall and shows the flagpole, and no helipad, turbine or blimp

#### Scenario: Full ladder
- **WHEN** a user's total is 5B or more
- **THEN** its HQ is eleven floors tall with the flagpole, the helicopter on the roof, the turning turbine and the bobbing blimp

#### Scenario: Threshold crossed while running
- **WHEN** a user's total goes from 99M to 101M
- **THEN** its HQ gains a floor and the flagpole in place, without sinking

#### Scenario: Two users
- **WHEN** the park shows sessions of a user with 2B tokens and a user with 20M tokens
- **THEN** each user has its own HQ next to its own lots, the first nine floors tall with a helicopter and the second two floors tall

#### Scenario: Hover an HQ
- **WHEN** the pointer is over the HQ of `noor`, who runs 3 sessions on a machine with 5B tokens
- **THEN** a tooltip shows `noor`, `head office`, `3 agents` and `5B tokens`

#### Scenario: Hover the block around it
- **WHEN** the pointer is over the lawn or the plaza of an HQ
- **THEN** no tooltip is shown

#### Scenario: Filter on one user
- **WHEN** the filter panel is set to one user
- **THEN** only that user's HQ and lots are shown

#### Scenario: Machine sends no total
- **WHEN** every session of a user comes from a machine that reports no token total
- **THEN** its HQ is a one floor office

## MODIFIED Requirements

### Requirement: Token milestones
A lot SHALL show extras in its yard for the season token total of its session's machine, counted from the season start as the `agent-tracking` spec describes, and its user's HQ SHALL show the rest. The extras SHALL be cumulative: every row of the table at or below the total is shown.

| Tokens | Extra | Where |
|---|---|---|
| 10M | bike rack with 3 bikes at the people door | yard |
| 25M | 1st parked car in the car bays | yard |
| 50M | 2nd parked car | yard |
| 100M | 3rd parked car | yard |
| 100M | flagpole with a flag in the user's tint | HQ |
| 250M | coffee cart and a picnic table along the walkway | yard |
| 500M | the truck at the dock bay | yard |
| 750M | 2 EV chargers and a sports car in the front left corner | yard |
| 1B | helipad with a helicopter | HQ roof |
| 2.5B | wind turbine, blades turning | HQ plot |
| 5B | blimp in the user's tint, bobbing | above the HQ |

With a total below 10M the yard SHALL hold no vehicles and no extras; the car bay lines and truck bay lines SHALL stay. The extras SHALL be the same on every model tier and SHALL NOT overlap the hall, the machines, the warehouse slots or the worker routes. When the total crosses a threshold, the lot SHALL be rebuilt in place, without sinking and without moving its warehouses. The rows marked HQ SHALL stand on the user's HQ and SHALL NOT be built in any yard.

#### Scenario: Empty yard
- **WHEN** a session's machine has a total of 0
- **THEN** its yard shows the bay lines and no vehicles, bikes or other extras

#### Scenario: First car
- **WHEN** a session's machine has a total of 30M
- **THEN** its yard shows the bike rack and 1 parked car, and nothing from the rows above 30M

#### Scenario: Middle of the ladder
- **WHEN** a session's machine has a total of 600M
- **THEN** its yard shows the bike rack, 3 parked cars, the coffee cart, the picnic table and the truck, and no EV chargers or sports car

#### Scenario: Full ladder
- **WHEN** a session's machine has a total of 5B or more
- **THEN** its yard shows every row marked yard, and no helicopter, turbine, blimp or flagpole

#### Scenario: Threshold crossed while running
- **WHEN** a session's machine total goes from 99M to 101M
- **THEN** the 3rd car appears in its yard in place, the lot does not sink, and its warehouses stay where they were

#### Scenario: Two machines on a hub
- **WHEN** the park shows sessions from a machine with 2B tokens and a machine with 20M tokens
- **THEN** every lot of the first machine shows the truck, and every lot of the second shows only the bike rack

#### Scenario: Small tier
- **WHEN** a session runs `claude-haiku-4-5-20251001` on a machine with 1B tokens
- **THEN** its small lot shows the same extras as a huge lot would

#### Scenario: Lot goes idle
- **WHEN** a session becomes idle
- **THEN** the parked vehicles its token milestones added stay in the yard

#### Scenario: Machine sends no total
- **WHEN** a session comes from a machine that does not report a token total
- **THEN** its yard shows the bay lines and no extras
