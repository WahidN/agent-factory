## ADDED Requirements

### Requirement: Report model
The system SHALL report the model id that each session and each subagent is using, taken from the model field of the latest assistant message in its transcript. The placeholder value `<synthetic>` SHALL be ignored. When no model is known yet, the model SHALL be empty. A subagent's model SHALL start from the model alias in its meta file, when that file has one, until its transcript names a model.

#### Scenario: Model read from the transcript
- **WHEN** the latest assistant line of a session's transcript names the model `claude-opus-5`
- **THEN** the session's model is `claude-opus-5`

#### Scenario: Model switch
- **WHEN** a later assistant line names a different model than the one before it
- **THEN** connected clients receive the new model within 1 second

#### Scenario: Synthetic message
- **WHEN** the latest assistant line has the model `<synthetic>`
- **THEN** the session's model stays what the previous assistant line named

#### Scenario: No assistant message yet
- **WHEN** a session is listed but no assistant line has been read from its transcript
- **THEN** the session's model is empty

#### Scenario: Subagent alias
- **WHEN** a subagent's meta file says `"model": "sonnet"` and its transcript has no assistant line yet
- **THEN** the subagent's model is `sonnet`

#### Scenario: Subagent transcript names the model
- **WHEN** a subagent's transcript gets an assistant line naming `claude-sonnet-5`
- **THEN** the subagent's model is `claude-sonnet-5`
