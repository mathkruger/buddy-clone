## REMOVED Requirements

### Requirement: Public profile page
**Reason**: Profile viewing is now gated behind accounts so only logged-in users can view other users' profiles; the publicly viewable form of a profile is the embed widget.
**Migration**: Logged-in users open `/:username`; anonymous visitors use `/embed/:username` or are redirected to the login page.

## ADDED Requirements

### Requirement: Profile page requires login
The system SHALL expose a page per username at a predictable URL (e.g. `/:username`) that renders the user's avatar with current mood. Only a logged-in account SHALL be able to view it; an anonymous visitor SHALL be redirected to the login page instead of receiving profile data. The embed widget SHALL remain publicly viewable without a login.

#### Scenario: Visiting an existing profile while logged in
- **WHEN** a logged-in user opens the profile URL of an existing username
- **THEN** the page shows the user's avatar, current mood, and interaction area

#### Scenario: Anonymous visitor is redirected
- **WHEN** a visitor who is not logged in opens a profile URL
- **THEN** the system redirects them to the login page and serves no profile data

#### Scenario: Visiting a non-existent username
- **WHEN** a logged-in user opens the profile URL of a username that has not been created
- **THEN** the system shows a not-found page indicating the profile does not exist

## MODIFIED Requirements

### Requirement: Edit controls only for the owner
The profile SHALL display edit controls (change avatar / change mood) only when the visitor is logged in as the same username as the profile. Otherwise the profile SHALL be read-only.

#### Scenario: Owner sees edit controls
- **WHEN** a user logged in as the profile's owner loads the profile
- **THEN** the page shows controls to edit the avatar and change the mood

#### Scenario: Visitor sees a read-only profile
- **WHEN** a user logged in as a different account loads the profile
- **THEN** the page shows no edit controls and the visitor can only view and interact