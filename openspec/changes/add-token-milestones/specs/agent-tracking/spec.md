## ADDED Requirements

### Requirement: Report season token usage
The system SHALL report, with every session, the season token total of the machine the session runs on. The total SHALL be the sum, over every transcript under `~/.claude/projects/`, including subagent transcripts and transcripts of sessions that have ended, of the input, output, cache creation and cache read tokens of every assistant message written at or after the season start, 2026-09-16T00:00:00Z. A message written before the season start SHALL add nothing. A message that appears more than once with the same message id and request id SHALL be counted once, with the largest total among its copies. A transcript line without a usage block SHALL add nothing. The total SHALL be 0 until the first full scan has finished. After that, tokens from new transcript lines SHALL be added within 1 second, and the full scan SHALL NOT run again while the system runs.

#### Scenario: Full scan on start
- **WHEN** the system starts with transcripts on disk that hold 3 assistant messages written after the season start of 100, 200 and 300 tokens in total
- **THEN** once the scan has finished, every listed session reports a season total of 600

#### Scenario: Message before the season start
- **WHEN** a transcript holds an assistant message of 500 tokens with timestamp 2026-09-15T23:59:59Z and one of 100 tokens with timestamp 2026-09-16T00:00:00Z
- **THEN** the total is 100

#### Scenario: Streamed message logged twice
- **WHEN** a transcript holds two lines with the same message id and request id, the first with 50 output tokens and the second with 80
- **THEN** that message adds 80 output tokens to the total, not 130

#### Scenario: Resumed session copies a message
- **WHEN** the same message id and request id appear in two transcript files
- **THEN** that message is counted once

#### Scenario: Subagent tokens count
- **WHEN** a subagent transcript holds an assistant message with a usage block
- **THEN** its tokens are added to the total

#### Scenario: Live growth
- **WHEN** a running transcript gets a new assistant line with a usage block
- **THEN** connected clients receive every session of that machine with the new total within 1 second

#### Scenario: Scan not finished yet
- **WHEN** a client connects before the first scan has finished
- **THEN** every session carries a total of 0, and the client receives every session again with the real total once the scan is done

#### Scenario: Line without usage
- **WHEN** a transcript line is a user message, a tool result, or an assistant line without a usage block
- **THEN** the total does not change

## MODIFIED Requirements

### Requirement: Large transcripts stay cheap
The system SHALL work out a session's current tool without reading its whole transcript, and SHALL read only newly added content after that. The one time token scan at start SHALL read whole transcripts in the background and SHALL NOT delay the session list or the current tool.

#### Scenario: Very large transcript
- **WHEN** a session's transcript is many megabytes
- **THEN** the session appears with its current tool without reading the whole file

#### Scenario: Scan while sessions run
- **WHEN** the system starts with many megabytes of transcripts on disk
- **THEN** running sessions are listed with their current tool before the token scan finishes
