## Purpose

Provides public, username-based profile pages that display a user's avatar, current mood, and received interactions without requiring any registration or password.

## ADDED Requirements

### Requirement: Public profile page
The system SHALL expose a public page per username at a predictable URL (e.g. `/:username`) that renders the user's avatar with current mood. Any visitor MUST be able to view the page without logging in.

#### Scenario: Visiting an existing profile
- **WHEN** a visitor opens the profile URL of an existing username
- **THEN** the page shows the user's avatar, current mood, and interaction area

#### Scenario: Visiting a non-existent username
- **WHEN** a visitor opens the profile URL of a username that has not been created
- **THEN** the system shows a not-found page indicating the profile does not exist

### Requirement: Profile reflects saved data
The profile SHALL render from the persisted avatar composition and mood. When the owner changes the avatar parts or mood, the profile page MUST reflect the change on the next load.

#### Scenario: Profile updates after mood change
- **WHEN** the profile owner changes their mood and the page is reloaded
- **THEN** the profile renders the avatar showing the new mood

### Requirement: Edit controls only for the owner
The profile SHALL display edit controls (change avatar / change mood) only when the visitor's browser holds the profile's claim token. Otherwise the profile SHALL be read-only.

#### Scenario: Owner sees edit controls
- **WHEN** the browser holding the profile's claim token loads the profile
- **THEN** the page shows controls to edit the avatar and change the mood

#### Scenario: Visitor sees a read-only profile
- **WHEN** a browser without the claim token loads the profile
- **THEN** the page shows no edit controls and the visitor can only view and interact

### Requirement: Interaction entry point
The profile SHALL present a way for visitors to send an interaction (animated effect) to the user, showing which interactions are available.

#### Scenario: Interaction controls are visible
- **WHEN** a visitor loads any existing profile
- **THEN** the page shows at least one selectable interaction and a control to trigger it