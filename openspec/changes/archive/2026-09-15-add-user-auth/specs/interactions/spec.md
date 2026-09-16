## MODIFIED Requirements

### Requirement: Sending an interaction
Only a logged-in account SHALL be able to send an interaction to a user by selecting it on the target's profile. The system MUST record the interaction with the sender's authenticated username and MUST play the selected animation on the target's avatar. An anonymous visitor SHALL be rejected and MUST NOT be recorded as any sender.

#### Scenario: Visitor triggers an interaction
- **WHEN** a logged-in user selects an interaction on a profile and confirms it
- **THEN** the system records the interaction with that user's username and plays the corresponding animation featuring the target avatar

#### Scenario: Sending as a claimed buddy
- **WHEN** a user sends an interaction to a profile while logged in to their own account
- **THEN** the system records the sender as that user's username

#### Scenario: Sending as a guest
- **WHEN** a visitor who is not logged in attempts to send an interaction
- **THEN** the system rejects the request, records no interaction, and attributes no sender

#### Scenario: Sending to a non-existent user
- **WHEN** a logged-in user attempts to send an interaction to a username that has no profile
- **THEN** the system rejects the interaction and shows a not-found response

### Requirement: Interaction history
The system SHALL record interactions received per profile (interaction type, sender, and timestamp) and SHALL display the most recent interactions on the profile together with who sent each one. The sender SHALL be the authenticated username that sent the interaction. Interaction counts SHALL be reset or cleared only by explicit owner action.

#### Scenario: Interaction is recorded
- **WHEN** an interaction is successfully sent to a profile by a logged-in user
- **THEN** the profile shows the updated interaction count and the most recent interaction in its history with the sender's username

#### Scenario: Legacy interactions without a sender
- **WHEN** a profile's history contains an interaction that predates account authentication
- **THEN** the system displays that interaction's sender as the default guest sender