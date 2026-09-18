# User Profile Specification

## Purpose

Provides public, username-based profile pages that display a user's avatar, current mood, and received interactions without requiring any registration or password.

## Requirements

### Requirement: Profile reflects saved data
The profile SHALL render from the persisted avatar composition and mood. When the owner changes the avatar parts or mood, the profile page MUST reflect the change on the next load.

#### Scenario: Profile updates after mood change
- **WHEN** the profile owner changes their mood and the page is reloaded
- **THEN** the profile renders the avatar showing the new mood

### Requirement: Buddy appears on the play screen
The buddy's avatar and current mood SHALL be rendered on the play screen's main stage for its owner, reflecting the persisted appearance composition and mood.

#### Scenario: Play screen renders the buddy
- **WHEN** the owner opens the play screen
- **THEN** the main stage shows the owner's buddy with the saved appearance and, when a mood is set, that mood's visual treatment

#### Scenario: Mood change is reflected on the stage
- **WHEN** the owner changes the mood via the Humor tab
- **THEN** the main stage renders the buddy with the newly applied mood treatment