## Purpose

Recreates the classic Buddy Poke mechanic of sending animated interactions between users, letting visitors trigger original animated effects that play on a target user's profile avatar.

## ADDED Requirements

### Requirement: Interaction catalog
The system SHALL provide a catalog of predefined interactions (e.g. poke, hug, high-five, kiss, dance), each with a distinct original animation. Interactions MUST be playable without any external animation service.

#### Scenario: Catalog is browsable
- **WHEN** a visitor opens the interaction area of a profile
- **THEN** they can see and select from the available interactions

### Requirement: Sending an interaction
Any visitor SHALL be able to send an interaction to a user by selecting it on the target's profile. The system MUST record the interaction and MUST play the selected animation on the target's avatar. A sender who has claimed a profile MAY have their avatar appear in the animation; otherwise a default guest avatar SHALL be used.

#### Scenario: Visitor triggers an interaction
- **WHEN** a visitor selects an interaction on a profile and confirms it
- **THEN** the system records the interaction and plays the corresponding animation featuring the target avatar

#### Scenario: Sending to a non-existent user
- **WHEN** a visitor attempts to send an interaction to a username that has no profile
- **THEN** the system rejects the interaction and shows a not-found response

### Requirement: Interaction history
The system SHALL record interactions received per profile (interaction type and timestamp) and SHALL display the most recent interactions on the profile. Interaction counts SHALL be reset or cleared only by explicit owner action.

#### Scenario: Interaction is recorded
- **WHEN** an interaction is successfully sent to a profile
- **THEN** the profile shows the updated interaction count and the most recent interaction in its history

### Requirement: Interaction animation playback
The animation SHALL play on the target's avatar within the profile page and SHALL complete without requiring the page to reload.

#### Scenario: Animation plays in place
- **WHEN** an interaction is triggered
- **THEN** the animation plays in place on the profile page and the page does not navigate or reload

#### Scenario: Repeat trigger replays
- **WHEN** a visitor triggers an interaction after one is already playing
- **THEN** the system queues or replays the animation without producing a broken or stuck state