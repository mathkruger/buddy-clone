## MODIFIED Requirements

### Requirement: Poke animation playback
When a poke plays, the system SHALL stage a scene on the play screen's main stage showing the sender's buddy and the target's buddy together within a single shared frame, with their placement and any contact between them determined by the interaction type, and SHALL complete without requiring the page to reload. The sender's buddy SHALL be the current user's own saved avatar, falling back to the default guest avatar when it cannot be resolved.

#### Scenario: Animation plays in place
- **WHEN** a poke is triggered from the Friends tab or poked back from the feed
- **THEN** the animation plays on the play screen's main stage and the page does not navigate or reload

#### Scenario: Three-part scene is staged
- **WHEN** a poke plays
- **THEN** the stage shows the sender's buddy, the poke effect, and the target's buddy brought together within a single shared frame rather than in separate columns

#### Scenario: The interaction determines placement and contact
- **WHEN** a poke plays
- **THEN** the sender's and target's buddies are positioned according to the poke's choreography, with the sender approaching the target and making contact at the distance defined for that interaction

#### Scenario: Sender shows the current user's buddy
- **WHEN** a logged-in user triggers a poke
- **THEN** the sender side of the shared frame shows that user's own saved avatar (or the default guest avatar if it cannot be resolved)

#### Scenario: Repeat trigger replays
- **WHEN** a visitor triggers a poke after one is already playing
- **THEN** the system queues or replays the animation without producing a broken or stuck state