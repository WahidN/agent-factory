## Purpose

What the office floor looks like and where things stand in it, so going inside your HQ feels like a real office and not an empty box.

## ADDED Requirements

### Requirement: An attic hall
The office SHALL be one long hall with a sloped, rough grey ceiling. The ceiling SHALL carry black ducts, track rails with spots and ring lights. The floor SHALL be oak, with a lighter carpet walkway running from the door to the far end of the hall.

#### Scenario: Walking in
- **WHEN** you enter the office
- **THEN** you stand at the door looking down a carpet walkway on an oak floor, under a sloped ceiling with ducts and ring lights

#### Scenario: Lights
- **WHEN** the office is on screen
- **THEN** the ring lights and spots are visible overhead and the room is lit evenly enough to read the desks

### Requirement: Desks in two blocks
Desks SHALL stand in two blocks on either side of the walkway, one white sit-stand desk per session, in a stable order. A wooden planter with plants SHALL stand between rows. The walkway SHALL stay free of desks whatever the number of sessions is. Robots, subagents and their poses SHALL be unchanged.

#### Scenario: Four sessions
- **WHEN** the user has four sessions
- **THEN** two desks stand on each side of the walkway, each with its robot, with a planter between the rows

#### Scenario: One session
- **WHEN** the user has one session
- **THEN** one desk stands beside the walkway and the rest of the hall is still furnished

#### Scenario: Many sessions
- **WHEN** the user has more sessions than fit in the first rows
- **THEN** the hall grows longer, never wider, and the walkway stays clear

### Requirement: Zones in the hall
The hall SHALL hold these zones, in this order from the door: a moss wall with the user's name in white letters, an olive green door and a wall screen; the desks; a kitchen block with white cabinets, a grey island and black bins; a round table with black chairs under a triangle window; a long dark table with beige chairs. One long side SHALL be a glass meeting-room wall with black frames. The other side SHALL have a diagonal wooden slat partition and a half-round window with sky.

#### Scenario: Name on the moss wall
- **WHEN** the user is `wahid`
- **THEN** the moss wall by the door spells `WAHID` in white letters

#### Scenario: Windows show sky
- **WHEN** you look at the triangle or the half-round window
- **THEN** you see sky through it

### Requirement: Furniture blocks you
Everything in the hall that stands on the floor SHALL stop you from walking through it, the same way desks and robots do.

#### Scenario: Walking into the kitchen island
- **WHEN** you walk into the kitchen island
- **THEN** you stop at its edge

### Requirement: No people
The room SHALL NOT show any people. The only figures in it are the robots.

#### Scenario: Empty chairs
- **WHEN** you look at the dining chairs and the long table
- **THEN** nobody sits at them
