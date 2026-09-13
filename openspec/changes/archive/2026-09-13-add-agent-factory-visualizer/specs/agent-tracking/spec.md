## Purpose

Discovers the Claude Code sessions and subagents running on this laptop, works out whether each one is working and which tool it is using, and streams that state to connected clients.

## ADDED Requirements

### Requirement: Discover running sessions
The system SHALL list every Claude Code session that has a session file in `~/.claude/sessions/` and whose process is still alive. Each session SHALL expose its id, name, working folder, start time, and status.

#### Scenario: Running session is listed
- **WHEN** a session file exists and its process id belongs to a running process
- **THEN** the session appears in the session list with its name, folder, start time, and status

#### Scenario: Leftover file from a dead process
- **WHEN** a session file exists but its process id is not running
- **THEN** the session does not appear in the session list

#### Scenario: Session process exits
- **WHEN** a listed session's file is deleted or its process stops running
- **THEN** the session is removed from the list within 5 seconds and connected clients are told it was removed

### Requirement: Report session status
The system SHALL report each session's status as `busy` or `idle`, taken from its session file.

#### Scenario: Session starts working
- **WHEN** a session file's status changes from `idle` to `busy`
- **THEN** connected clients receive the updated status within 1 second

### Requirement: Report current tool
The system SHALL report the tool a session is currently running, based on its transcript. A tool is running from the moment its tool call is written until its matching result is written. When no tool is running, the current tool SHALL be empty.

#### Scenario: Tool call in progress
- **WHEN** the transcript's latest tool call has no matching result yet
- **THEN** the session's current tool is that tool's name and short label

#### Scenario: Tool call finished
- **WHEN** the matching result for the running tool call is written
- **THEN** the session's current tool becomes empty

#### Scenario: Transcript not created yet
- **WHEN** a session is running but its transcript file does not exist yet
- **THEN** the session is still listed with an empty current tool, and its current tool is reported once the transcript appears

#### Scenario: Incomplete or unknown transcript line
- **WHEN** a transcript line is half-written or has a shape the system does not recognize
- **THEN** the line is ignored without affecting other sessions, and a half-written line is read again once it is complete

### Requirement: Short tool labels only
The system SHALL send only a short label describing the tool's target, and SHALL NOT send prompts, responses, or file contents to clients.

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

### Requirement: Track subagents
The system SHALL list the subagents of each session with their name, status, and current tool, using the same current tool rules as sessions. A subagent SHALL be `busy` when it has a running tool or its transcript changed in the last 5 seconds, and `idle` otherwise.

#### Scenario: Subagent starts
- **WHEN** a new subagent transcript appears for a listed session
- **THEN** the subagent is added to that session's subagent list

#### Scenario: Subagent goes quiet
- **WHEN** a subagent has no running tool and its transcript has not changed for 60 seconds
- **THEN** the subagent is removed from its session's subagent list

### Requirement: Stream state to clients
The system SHALL send the full list of sessions to a client when it connects, then send an update each time a session or one of its subagents changes, and a removal notice when a session ends.

#### Scenario: Client connects
- **WHEN** a client connects
- **THEN** it immediately receives every listed session with its subagents

#### Scenario: Session changes
- **WHEN** a session's status, current tool, or subagents change
- **THEN** every connected client receives that session's new state

### Requirement: Local and read-only
The system SHALL accept connections only from the same machine and SHALL NOT write to, move, or delete any file under `~/.claude/`.

#### Scenario: Connection from another device
- **WHEN** a device on the same network tries to connect to the server
- **THEN** the connection is refused

#### Scenario: Normal operation
- **WHEN** the system runs while sessions are active
- **THEN** no file under `~/.claude/` is created, changed, or deleted by it

### Requirement: Large transcripts stay cheap
The system SHALL work out a session's current tool without reading its whole transcript, and SHALL read only newly added content after that.

#### Scenario: Very large transcript
- **WHEN** a session's transcript is many megabytes
- **THEN** the session appears with its current tool without reading the whole file
