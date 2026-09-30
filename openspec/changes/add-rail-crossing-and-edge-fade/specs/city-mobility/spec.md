## Purpose

The city traffic that belongs to Nijmegen rather than to a session: cyclists and buses on the park
roads, the train on the Spoorbrug line, and the level crossings where the road traffic and the train
meet.

## ADDED Requirements

### Requirement: Cyclists and buses leave at the edge
Cyclists and buses SHALL ride the park roads and take a turn at each crossing. Where the road ends,
so at a crossing with no onward road, they SHALL NOT turn around. They SHALL fade out at the end of
that road and a replacement SHALL fade in on another road of the park, so the number of cyclists and
the number of buses stay the same.

#### Scenario: Cyclist reaches the end of the road
- **WHEN** a cyclist rides onto a road that ends at the edge of the built park
- **THEN** it fades out at that end instead of turning around, and one cyclist fades in elsewhere

#### Scenario: Bus reaches the end of the road
- **WHEN** a bus rides onto a road that ends at the edge of the built park
- **THEN** it fades out at that end instead of turning around, and one bus fades in elsewhere

#### Scenario: Replacement appears somewhere else
- **WHEN** the same cyclist has faded out at the edge twice
- **THEN** its two replacements do not both start on the same road at the same spot

#### Scenario: Count stays stable
- **WHEN** the city runs for several minutes with cyclists reaching the edge
- **THEN** the number of cyclists on the roads is the number the city asked for

### Requirement: Train service
While the river is in the scene, the railway SHALL carry a train service instead of a single
shuttling train. One train at a time SHALL enter at one end of the track, drive the whole track in
one direction, and fade out past the far end. A train SHALL NOT reverse direction on the track. The
rails SHALL then stay empty for 35 to 60 seconds before the next train enters, and the entry end
SHALL vary so trains come from both directions.

#### Scenario: Train runs one way
- **WHEN** a train enters the track
- **THEN** it keeps the same direction until it has passed the far end, where it fades out

#### Scenario: Quiet track between trains
- **WHEN** a train has faded out past the end of the track
- **THEN** no train is on the rails for at least 35 seconds

#### Scenario: Trains come from both ends
- **WHEN** several trains have passed
- **THEN** some entered from the south end and some from the north end

#### Scenario: No river
- **WHEN** the scene has no river yet
- **THEN** no train runs and the barriers stay open

### Requirement: Level crossings
Every place where an east-west road crosses the stretch of railway the train drives SHALL show a
level crossing: a post with a red and white boom on each side of the road. The rails end on a road
at each end of the track, half a train past the point where the train turns around, so that road
SHALL NOT get barriers: no train ever reaches it. The booms SHALL be up while no train is coming.
They
SHALL lower before an approaching train reaches the crossing, stay down while the train passes, and
rise once the train has cleared the crossing. The booms SHALL move over about a second, not snap
between up and down.

#### Scenario: Barriers at every crossing the train reaches
- **WHEN** the built park has three roads that cross the stretch the train drives
- **THEN** each of those three roads has barriers on both sides of the track

#### Scenario: Train approaches
- **WHEN** a train comes within the approach distance of a crossing
- **THEN** that crossing's booms lower before the train reaches it

#### Scenario: Train passes
- **WHEN** the train has driven past a crossing far enough to be clear of it
- **THEN** that crossing's booms rise again

#### Scenario: No train
- **WHEN** no train is on the rails
- **THEN** every crossing's booms are up

#### Scenario: Park grows
- **WHEN** the park grows and the railway gets a new road crossing it
- **THEN** that new crossing gets its own barriers

### Requirement: Road traffic waits for a closed barrier
Cars, trucks, cyclists and buses SHALL stop before the track while the barrier of the crossing ahead
of them is down, and drive on once it is up. A vehicle that is already on the crossing when the
barrier lowers SHALL keep going and clear the track instead of stopping on it. Cars and trucks
waiting at a crossing SHALL queue behind each other instead of overlapping. Waiting cyclists and
buses SHALL stand spread out over the last stretch of road instead of on one spot.

#### Scenario: Car waits
- **WHEN** a car drives toward a crossing whose barrier is down
- **THEN** it stops clear of the track and does not cross

#### Scenario: Car drives on
- **WHEN** the barrier in front of a waiting car rises
- **THEN** the car drives on across the track

#### Scenario: Car already on the track
- **WHEN** the barrier lowers while a car is on the crossing
- **THEN** that car drives on and clears the track

#### Scenario: Queue at a closed crossing
- **WHEN** three cars arrive at a crossing whose barrier is down
- **THEN** they stand in a queue behind each other, not on the same spot

#### Scenario: Waiting cyclists
- **WHEN** three cyclists wait at a crossing whose barrier is down
- **THEN** they stand at different spots on the road, not all on the same one
