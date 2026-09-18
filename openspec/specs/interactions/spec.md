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
Only a logged-in account SHALL be able to send a poke to a friend from the play screen's Friends tab (or by poking a sender back from the BuddyClone feed). The system MUST record the poke with the sender's authenticated username and MUST play the selected animation on the play screen's main stage. The system SHALL reject any poke in which the sender is also the target, recording nothing. An anonymous visitor SHALL be rejected and MUST NOT be recorded as any sender.

#### Scenario: Visitor triggers an interaction
- **WHEN** a logged-in user selects a poke on a friend's entry in the Friends tab and confirms it
- **THEN** the system records the poke with that user's authenticated username and plays the corresponding animation on the main stage

#### Scenario: Sending as a claimed buddy
- **WHEN** a logged-in user sends a poke to a friend
- **THEN** the system records the sender as that user's authenticated username

#### Scenario: Sending as a guest
- **WHEN** a visitor who is not logged in attempts to send a poke
- **THEN** the system rejects the request, records no poke, and attributes no sender

#### Scenario: Sending to a non-existent user
- **WHEN** a logged-in user attempts to send a poke to a target that has no account
- **THEN** the system rejects the poke and the poke is not recorded

#### Scenario: Poking your own profile
- **WHEN** a user attempts to send a poke to their own account
- **THEN** the system rejects the request with a client error and does not record the poke

#### Scenario: Viewing your own profile
- **WHEN** a user views their own pokes feed in the BuddyClone tab
- **THEN** the feed shows their received interactions, offers replay and poke-back, and does not offer controls to poke themselves

### Requirement: Interaction history
The system SHALL record pokes received per profile (poke type, sender, and timestamp) and SHALL display them to the owner as messages in the play screen's BuddyClone feed, together with who sent each one. The owner SHALL be able to replay any received poke locally and to poke the sender back. Poke counts SHALL be reset or cleared only by explicit owner action.

#### Scenario: Interaction is recorded
- **WHEN** a poke is successfully sent to a profile
- **THEN** the recipient's BuddyClone feed shows the poke with its type, its sender, and the time it was received

#### Scenario: Legacy interactions without a sender
- **WHEN** a feed contains a poke that predates sender tracking
- **THEN** the system displays that poke's sender as the default guest sender

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

### Requirement: Pokes feed replay and poke-back
The BuddyClone tab SHALL list every received poke as a message with a replay control and a poke-back control. Replaying SHALL play the animation locally without recording a new poke; poking back SHALL send a poke of the same type to that sender, record it, and play it on the main stage.

#### Scenario: Replaying a received poke
- **WHEN** the owner activates the replay control on a poke message
- **THEN** the same poke animation plays locally without recording a new poke and without reloading the page

#### Scenario: Poking a sender back from the feed
- **WHEN** the owner activates the poke-back control on a poke message
- **THEN** the system records a poke of the same type to that sender and plays the animation on the main stage

### Requirement: Poke animation playback
When a poke plays, the system SHALL stage a scene on the play screen's main stage showing the sender's buddy on one side, the poke effect in the middle, and the target's buddy on the other side, and SHALL complete without requiring the page to reload. The sender's buddy SHALL be the current user's own saved avatar, falling back to the default guest avatar when it cannot be resolved.

#### Scenario: Animation plays in place
- **WHEN** a poke is triggered from the Friends tab or poked back from the feed
- **THEN** the animation plays on the play screen's main stage and the page does not navigate or reload

#### Scenario: Three-part scene is staged
- **WHEN** a poke plays
- **THEN** the stage displays the sender's buddy on one side, the poke effect in the middle, and the target's buddy on the other side

#### Scenario: Sender shows the current user's buddy
- **WHEN** a logged-in user triggers a poke
- **THEN** the sender side of the stage shows that user's own saved avatar (or the default guest avatar if it cannot be resolved)

#### Scenario: Repeat trigger replays
- **WHEN** a visitor triggers a poke after one is already playing
- **THEN** the system queues or replays the animation without producing a broken or stuck state