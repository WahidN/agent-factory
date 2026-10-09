## Purpose

Where a user's HQ stands among that user's own halls, so the HQ reads as the centre of the yard.

## ADDED Requirements

### Requirement: HQ in the middle of its user's lots
An HQ SHALL stand on the plot of its user's run that lies closest to the middle of that run, and the user's halls SHALL stand on the other plots of the run. When two plots are equally close, the one that comes first on the curve SHALL win. The run SHALL stay one block with no gaps and no plot of another user in it, and the layout SHALL stay a pure function of the set of sessions on the park.

#### Scenario: Several sessions
- **WHEN** a user has five sessions
- **THEN** the HQ stands on the plot closest to the middle of the user's six plots, and halls stand on the others

#### Scenario: One session
- **WHEN** a user has one session
- **THEN** the user has an HQ and one hall on two neighbouring plots

#### Scenario: Same set, same layout
- **WHEN** the same sessions arrive in a different order, or on another viewer
- **THEN** every HQ and every hall stands on the same plot

#### Scenario: A session starts or stops
- **WHEN** one of a user's sessions starts or stops
- **THEN** the HQ is allowed to move to the new middle of the run, and no plot is left empty

#### Scenario: Last session ends
- **WHEN** a user's last session is removed
- **THEN** the HQ goes away and its plot goes back to the city
