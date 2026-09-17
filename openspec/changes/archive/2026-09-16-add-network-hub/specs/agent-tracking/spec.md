## ADDED Requirements

### Requirement: Relay to a hub
When started with a hub address, the system SHALL connect to that hub, identify the machine it runs on, send its full session list, and then send every session update and removal as it happens. While the hub cannot be reached the system SHALL retry every 2 seconds, and after a reconnect it SHALL send its full session list again. Relaying SHALL NOT change what the system does locally: it still lists its own sessions and still accepts local clients.

#### Scenario: Hub reachable at start
- **WHEN** the system starts with a hub address and the hub is running
- **THEN** the hub receives the machine name followed by every listed session with its subagents

#### Scenario: Session changes while relaying
- **WHEN** a relayed session's status, current tool, or subagents change
- **THEN** the hub receives that session's new state within 1 second

#### Scenario: Hub not running
- **WHEN** the hub cannot be reached
- **THEN** the system keeps listing its own sessions and tries the hub again every 2 seconds

#### Scenario: Hub comes back
- **WHEN** the hub becomes reachable again
- **THEN** the system reconnects without a restart and sends its full session list

#### Scenario: Page on a relaying machine
- **WHEN** the page is opened on a machine started with a hub address
- **THEN** it shows the hub's sessions, including this machine's own

### Requirement: Merge sessions as a hub
When started as a hub, the system SHALL accept connections from other machines on the network, SHALL list the sessions relayed by each connected machine next to its own, and SHALL send all of them to clients under "Stream state to clients". A relayed session's id SHALL be prefixed with the name of the machine it came from. When a machine's connection closes, all of its sessions SHALL be removed. When a machine sends its full session list, the hub SHALL remove any of that machine's sessions that are not in the list. The hub SHALL close a connection from a machine that speaks another protocol version and log why.

#### Scenario: Machine joins
- **WHEN** a machine connects to the hub and sends 2 sessions
- **THEN** connected clients receive both sessions with that machine's name, and a client that connects afterwards receives them in its snapshot together with the hub's own sessions

#### Scenario: Machine leaves
- **WHEN** a machine's connection to the hub closes
- **THEN** connected clients are told that each of that machine's sessions was removed

#### Scenario: Machine reconnects with fewer sessions
- **WHEN** a machine reconnects and its new full list is missing a session it sent before
- **THEN** connected clients are told that session was removed and receive the sessions that are in the new list

#### Scenario: Two machines, one session id each
- **WHEN** two machines each relay one session
- **THEN** clients see two sessions whose ids start with different machine names

#### Scenario: Wrong protocol version
- **WHEN** a machine connects with a protocol version the hub does not speak
- **THEN** the hub closes that connection, logs the machine name and both versions, and no session from it is listed

## MODIFIED Requirements

### Requirement: Discover running sessions
The system SHALL list every Claude Code session that has a session file in `~/.claude/sessions/` and whose process is still alive. Each session SHALL expose its id, name, folder name, machine name, start time, and status. The folder name SHALL be the last part of the session's working folder. The machine name SHALL be the short host name of the machine the session runs on, and SHALL be the same for a session and its subagents.

#### Scenario: Running session is listed
- **WHEN** a session file exists and its process id belongs to a running process
- **THEN** the session appears in the session list with its name, folder name, machine name, start time, and status

#### Scenario: Folder name
- **WHEN** a session runs in `/Users/wahid/Projecten/agent-factory`
- **THEN** its folder name is `agent-factory`

#### Scenario: Leftover file from a dead process
- **WHEN** a session file exists but its process id is not running
- **THEN** the session does not appear in the session list

#### Scenario: Session process exits
- **WHEN** a listed session's file is deleted or its process stops running
- **THEN** the session is removed from the list within 5 seconds and connected clients are told it was removed

### Requirement: Short tool labels only
The system SHALL send only a short label describing the tool's target, and SHALL NOT send prompts, responses, file contents, or full folder paths to clients or to a hub. The only things that leave the system are the session and subagent names, status, tool name and label, model id, folder name, machine name, and timing.

#### Scenario: File edit label
- **WHEN** the running tool edits or writes a file
- **THEN** the label is the file's base name, without its folder path

#### Scenario: Shell command label
- **WHEN** the running tool runs a shell command
- **THEN** the label is at most the first 40 characters of the command

#### Scenario: Search label
- **WHEN** the running tool searches file contents
- **THEN** the label is at most the first 40 characters of the search pattern

#### Scenario: Other tools
- **WHEN** the running tool is any other tool
- **THEN** the label is empty

#### Scenario: No full paths
- **WHEN** a session's state is sent to a client or a hub
- **THEN** it contains the folder name and not the folder's full path

### Requirement: Local and read-only
Unless started as a hub, the system SHALL accept connections only from the same machine. Started as a hub, it SHALL accept connections from other machines on the network. In every mode the system SHALL NOT write to, move, or delete any file under `~/.claude/`.

#### Scenario: Connection from another device
- **WHEN** the system is not started as a hub and a device on the same network tries to connect
- **THEN** the connection is refused

#### Scenario: Connection to a hub from another device
- **WHEN** the system is started as a hub and a device on the same network connects
- **THEN** the connection is accepted

#### Scenario: Normal operation
- **WHEN** the system runs while sessions are active, in any mode
- **THEN** no file under `~/.claude/` is created, changed, or deleted by it
