# Interactions Specification

## Purpose

Recreates the classic Buddy Poke mechanic of sending animated interactions between users, letting visitors trigger original animated effects that play on a target user's profile avatar.

## Requirements

### Requirement: Interaction catalog
The system SHALL provide a catalog of predefined interactions (e.g. poke, hug, high-five, kiss, dance), each with a distinct original animation. Interactions MUST be playable without any external animation service.

#### Scenario: Catalog is browsable
- **WHEN** a visitor opens the interaction area of a profile
- **THEN** they can see and select from the available interactions

### Requirement: Sending an interaction
Only a logged-in account SHALL be able to send an interaction to a user by selecting it on the target's profile. The system MUST record the interaction with the sender's authenticated username and MUST play the selected animation on the target's avatar. The system SHALL reject any interaction in which the sender is also the target, recording nothing. An anonymous visitor SHALL be rejected and MUST NOT be recorded as any sender. A user viewing their own profile SHALL NOT be offered send controls.

#### Scenario: Visitor triggers an interaction
- **WHEN** a logged-in user selects an interaction on the profile of a different user and confirms it
- **THEN** the system records the interaction with that user's authenticated username and plays the corresponding animation featuring the target avatar

#### Scenario: Sending as a claimed buddy
- **WHEN** a logged-in user sends an interaction to a profile other than their own
- **THEN** the system records the sender as that user's authenticated username

#### Scenario: Sending as a guest
- **WHEN** a visitor who is not logged in attempts to send an interaction
- **THEN** the system rejects the request, records no interaction, and attributes no sender

#### Scenario: Sending to a non-existent user
- **WHEN** a logged-in user attempts to send an interaction to a username that has no profile
- **THEN** the system rejects the interaction and shows a not-found response

#### Scenario: Poking your own profile
- **WHEN** a user attempts to send an interaction to their own profile
- **THEN** the system rejects the request with a client error and does not record the interaction

#### Scenario: Viewing your own profile
- **WHEN** a user views their own profile
- **THEN** the interactions section shows their interaction history but no send controls, and indicates that they cannot poke themselves

### Requirement: Interaction history
The system SHALL record interactions received per profile (interaction type, sender, and timestamp) and SHALL display the most recent interactions on the profile together with who sent each one. Interaction counts SHALL be reset or cleared only by explicit owner action.

#### Scenario: Interaction is recorded
- **WHEN** an interaction is successfully sent to a profile
- **THEN** the profile shows the updated interaction count and the most recent interaction in its history with the sender's identity

#### Scenario: Legacy interactions without a sender
- **WHEN** a profile's history contains an interaction that predates sender tracking
- **THEN** the system displays that interaction's sender as the default guest sender

### Requirement: Interaction animation playback
When an interaction plays, the system SHALL stage a scene on the target's profile page showing the sender's buddy on one side, the interaction effect in the middle, and the target's buddy on the other side, and SHALL complete without requiring the page to reload. The sender's buddy SHALL be the current user's own saved avatar, falling back to the default guest avatar when it cannot be resolved. The visitor SHALL be able to replay the last played animation locally, without sending a new interaction and without reloading the page.

#### Scenario: Animation plays in place
- **WHEN** an interaction is triggered
- **THEN** the animation plays in place on the profile page and the page does not navigate or reload

#### Scenario: Three-part scene is staged
- **WHEN** an interaction plays
- **THEN** the stage displays the sender's buddy on one side, the interaction effect in the middle, and the target's buddy on the other side

#### Scenario: Sender shows the current user's buddy
- **WHEN** a logged-in user triggers an interaction on another profile
- **THEN** the sender side of the stage shows that user's own saved avatar (or the default guest avatar if it cannot be resolved)

#### Scenario: Repeat trigger replays
- **WHEN** a visitor triggers an interaction after one is already playing
- **THEN** the system queues or replays the animation without producing a broken or stuck state

#### Scenario: Replaying the last animation
- **WHEN** an interaction has played and the visitor activates the replay control
- **THEN** the same animation plays again locally without recording a new interaction and without reloading the page