## ADDED Requirements

### Requirement: Textured surfaces
The moss wall, oak floor, walkway and ceiling SHALL have a photo surface texture, at the same size on every surface whatever the size of the hall.

#### Scenario: Moss wall
- **WHEN** you stand in the office and look at the moss wall
- **THEN** it is one wall with a moss texture, not a field of separate blocks

#### Scenario: Both styles
- **WHEN** the page is opened with `?style=classic`
- **THEN** the same surfaces are textured

### Requirement: Plants with leaves
Plants SHALL be made of many drawn leaves in more than one kind, not of solid cones.

#### Scenario: Planter
- **WHEN** you stand next to a planter
- **THEN** you see leaves of different shapes and greens coming out of dark soil
