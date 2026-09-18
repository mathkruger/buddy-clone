# Play Screen Specification

## Purpose

Delivers the single authenticated play screen where a user's buddy lives: the avatar renders on one main stage and four tabs (BuddyClone, Friends, Humor, Appearance) cover pokes-as-messages, friends, mood, and customization.

## Requirements

### Requirement: Play screen
The system SHALL provide a single authenticated play screen at a fixed URL that renders the login user's buddy on a main stage and provides exactly four tabs: **BuddyClone**, **Friends**, **Humor**, and **Appearance**. Anonymous visitors SHALL be redirected to the login page.

#### Scenario: Authenticated user reaches the play screen
- **WHEN** a logged-in user opens the play screen URL
- **THEN** the page shows the buddy rendered on the main stage and the four tabs

#### Scenario: Anonymous user is redirected to login
- **WHEN** a visitor who is not logged in opens the play screen URL
- **THEN** the system redirects them to the login page

#### Scenario: Rendered buddy reflects the saved appearance and mood
- **WHEN** the play screen loads for an authenticated user
- **THEN** the stage renders that user's buddy using the persisted appearance composition and, when a mood is set, applies the mood's visual treatment and looping animation

### Requirement: BuddyClone tab
The BuddyClone tab SHALL present every poke the user has received as a message showing the sender, the poke type, and when it was received. The user SHALL be able to replay any received poke on the main stage and SHALL be able to poke the sender back.

#### Scenario: Received pokes appear as messages
- **WHEN** a user opens the BuddyClone tab and the account has received pokes
- **THEN** the tab lists each poke as a message with the sender's name, the poke type, and the time it was received

#### Scenario: Replaying a received poke
- **WHEN** a user activates the replay control on a poke message
- **THEN** the poke animation plays locally on the main stage without recording a new interaction

#### Scenario: Poking back from a poke message
- **WHEN** a user activates the poke-back control on a poke message
- **THEN** the system sends a poke of the same type to that sender, records it, and plays the animation on the main stage

#### Scenario: Empty pokes feed
- **WHEN** a user opens the BuddyClone tab and has received no pokes
- **THEN** the tab shows an empty-state message

### Requirement: Friends tab
The Friends tab SHALL let the user add a friend by typing their username (stored as a favorite), remove a friend, see each friend listed with the friend's avatar, and send a poke to any listed friend. The poke SHALL be recorded and its animation SHALL play on the main stage as a preview.

#### Scenario: Adding a friend by username
- **WHEN** a user types an existing buddy's username in the Friends tab and confirms
- **THEN** the system adds that username to the user's favorites and lists it in the Friends tab with the friend's avatar

#### Scenario: Adding an unknown username is rejected
- **WHEN** a user types a username that does not exist
- **THEN** the system rejects the add and the friends list is unchanged

#### Scenario: Adding an already-friended username
- **WHEN** a user adds a username already in their friends list
- **THEN** the friends list stays unchanged and the operation does not error

#### Scenario: Removing a friend
- **WHEN** a user removes a friend from the Friends tab
- **THEN** the system removes that username from the user's favorites and it disappears from the list

#### Scenario: Poking a friend
- **WHEN** a user selects a friend in the Friends tab, chooses a poke type, and confirms
- **THEN** the system records the poke with the user's authenticated username, the animation plays on the main stage showing the user's buddy and the friend's buddy, and the newly received poke appears in the friend's BuddyClone feed

#### Scenario: Empty friends list
- **WHEN** a user opens the Friends tab and has no friends
- **THEN** the tab shows an empty-state message and the add-by-username control

### Requirement: Humor tab
The Humor tab SHALL present every supported humor option. Clicking a humor SHALL play its animation on the main stage; a dedicated action SHALL set it as the user's current mood, which SHALL be persisted and loop on the stage while set. Selecting "None" SHALL clear the current mood. When no mood is set, the buddy SHALL cycle randomly through the humor animations while idle.

#### Scenario: Previewing a humor
- **WHEN** a user clicks a humor option in the Humor tab
- **THEN** the humor's animation plays on the main stage

#### Scenario: Setting a humor as the mood
- **WHEN** a user sets a humor as the current mood
- **THEN** the system persists that mood, the buddy loops that mood's animation and shows its visual treatment, including on later visits to the play screen

#### Scenario: Clearing the mood
- **WHEN** a user selects "None" in the Humor tab
- **THEN** the system clears the persisted mood and the buddy returns to idle cycling

#### Scenario: Random humor cycling when no mood is set
- **WHEN** the play screen loads or idles and no mood is set
- **THEN** the buddy cycles randomly through the humor animations instead of repeating a single mood

#### Scenario: Rejecting an unsupported humor
- **WHEN** a change request specifies a humor that is not in the supported humor set
- **THEN** the system rejects the request and leaves the current mood unchanged

### Requirement: Appearance tab
The Appearance tab SHALL let the user change the buddy's appearance from the vendored catalog, grouped by category (head, hair, clothes, shoes, hats, ears, and addons), with "ears" and "addons" mapping to the closest available catalog parts. Each category SHALL show only valid options for that category, rendered from the shared assets, and the main stage SHALL update live as options are chosen. The composition SHALL save through the standard avatar save endpoint, and the saved look SHALL be what the play screen renders on subsequent loads.

#### Scenario: Choosing an appearance option updates the stage
- **WHEN** a user selects an option in any Appearance category
- **THEN** the main stage immediately renders the buddy with that option applied, without reloading

#### Scenario: Categories show catalog-backed options
- **WHEN** a user browses an Appearance category
- **THEN** the tab shows only the valid options for that category from the vendored catalog and highlights the current selection

#### Scenario: Saving the appearance
- **WHEN** a user saves the appearance
- **THEN** the composition is persisted and the play screen renders the saved look on subsequent loads

### Requirement: Default appearance for new accounts
New accounts SHALL be created with a predefined simple default appearance — the plain base look with default hair, eyes, and mouth and no hat, clothing, shoes, props, or extras — that can then be customized in the Appearance tab.

#### Scenario: Registering applies the default look
- **WHEN** a new account is registered
- **THEN** the buddy is created with the predefined simple default appearance

#### Scenario: Default look is customizable
- **WHEN** the owner of a new account opens the Appearance tab
- **THEN** the options reflect the simple default look and can be changed and saved