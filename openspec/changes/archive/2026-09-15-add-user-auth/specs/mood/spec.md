## MODIFIED Requirements

### Requirement: Changing mood
The owner of a profile SHALL be able to change the current mood at any time by being logged in as that username. The system MUST persist the change, and the profile and embed widget MUST show the new mood on subsequent loads.

#### Scenario: Owner changes mood successfully
- **WHEN** the profile owner, logged in as that username, selects a new mood from the available moods
- **THEN** the system persists the new mood and the avatar re-renders showing it

#### Scenario: Rejecting an invalid mood
- **WHEN** a change request specifies a mood that is not in the supported mood set
- **THEN** the system rejects the request and leaves the current mood unchanged

#### Scenario: Non-owner cannot change mood
- **WHEN** a request to change mood is made by a visitor who is not logged in as the profile's username
- **THEN** the system rejects the request and the mood remains unchanged