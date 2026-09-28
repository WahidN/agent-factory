## MODIFIED Requirements

### Requirement: Traffic follows activity
Every session's lot SHALL send cars onto the park roads, busy or idle. An idle lot SHALL send 2 cars. A busy lot SHALL send 2 cars plus 1 for each busy subagent, with at most 6, and its truck. Vehicles SHALL appear on the roads around their own lot and then drive all roads of the park, not only the roads around their lot. Every road SHALL have one lane per direction; vehicles SHALL keep to the right lane and take a random turn at each crossing, never a U-turn, so traffic drives in both directions. Where the road ends, so at a crossing with no onward road, a vehicle SHALL fade out at that end; the lot that sent it SHALL then send a replacement, which appears on a road around its own lot. Vehicles SHALL appear and disappear smoothly and SHALL slow down and stop behind the vehicle ahead in their lane instead of overlapping it. A vehicle SHALL also stop before the railway while the level crossing ahead of it is closed, and drive on when it opens. Every yard SHALL also show 3 parked cars, whether the session is busy or idle.

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

#### Scenario: Vehicle reaches the end of the road
- **WHEN** a car drives onto a road that ends at the edge of the built park
- **THEN** it fades out at that end instead of turning around

#### Scenario: Lot keeps its cars
- **WHEN** one of a lot's cars has faded out at the edge of the park
- **THEN** that lot sends a replacement car onto a road around its own lot

#### Scenario: Closed level crossing
- **WHEN** a car drives toward the railway while a train is coming and the barrier is down
- **THEN** it stops clear of the track and drives on once the barrier rises
