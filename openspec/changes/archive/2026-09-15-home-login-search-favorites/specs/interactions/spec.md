## MODIFIED Requirements

### Requirement: Sending an interaction
Any visitor SHALL be able to send an interaction to a user by selecting it on the target's profile. The system MUST record the interaction with the sender's identity and MUST play the selected animation on the target's avatar. A sender who has claimed a profile and presents their valid claim token MUST be recorded and rendered under their username; a sender without a valid claimed identity SHALL be recorded and rendered as the default guest sender.

#### Scenario: Visitor triggers an interaction
- **WHEN** a visitor selects an interaction on a profile and confirms it
- **THEN** the system records the interaction with the sender's identity and plays the corresponding animation featuring the target avatar

#### Scenario: Sending as a claimed buddy
- **WHEN** a visitor sends an interaction while presenting the claim token for an existing profile other than the target
- **THEN** the system records the sender as that profile's username

#### Scenario: Sending as a guest
- **WHEN** a visitor sends an interaction without a valid claimed identity (no token, or a token that does not match an existing profile other than the target)
- **THEN** the system records the sender as the default guest sender

#### Scenario: Sending to a non-existent user
- **WHEN** a visitor attempts to send an interaction to a username that has no profile
- **THEN** the system rejects the interaction and shows a not-found response

### Requirement: Interaction history
The system SHALL record interactions received per profile (interaction type, sender, and timestamp) and SHALL display the most recent interactions on the profile together with who sent each one. Interaction counts SHALL be reset or cleared only by explicit owner action.

#### Scenario: Interaction is recorded
- **WHEN** an interaction is successfully sent to a profile
- **THEN** the profile shows the updated interaction count and the most recent interaction in its history with the sender's identity

#### Scenario: Legacy interactions without a sender
- **WHEN** a profile's history contains an interaction that predates sender tracking
- **THEN** the system displays that interaction's sender as the default guest sender