## ADDED Requirements

### Requirement: Name the user to a browser
A server that lists one machine's own sessions SHALL name that machine's user to every browser that connects, in the message that already tells the browser which kind of server it reached. A central SHALL name no user, because it serves sessions of many people and belongs to none of them. The name SHALL be the same one the machine's own sessions carry, so nothing new about a machine leaves it.

A browser that is told no user, or that reaches a server too old to send one, SHALL behave as if the user is unknown.

#### Scenario: Local server
- **WHEN** a browser connects to a server that lists its own machine's sessions as `wahid`
- **THEN** the first message names `wahid` as the user of that server

#### Scenario: Central
- **WHEN** a browser connects to a central
- **THEN** the first message names no user

#### Scenario: Older server
- **WHEN** a browser connects to a server that sends no user at all
- **THEN** the browser treats the user as unknown
