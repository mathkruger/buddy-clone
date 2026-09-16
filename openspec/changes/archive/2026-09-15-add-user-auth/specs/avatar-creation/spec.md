## MODIFIED Requirements

### Requirement: Saving an avatar requires a username
The system SHALL require a unique, non-empty username and a password that meets the minimum length policy to save an avatar. The system MUST persist the avatar composition and password account under that username, MUST assign the profile its default mood, MUST start an authenticated session for the creator, and MUST direct the user to a confirmation with a link to their profile. A user who is already logged in SHALL NOT be able to create another buddy until they log out.

#### Scenario: Saving an avatar with a new username
- **WHEN** a user with a valid, unique username and an acceptable password saves their avatar
- **THEN** the system persists the avatar composition under that username, logs the user in as that username, and shows a confirmation with a link to their profile

#### Scenario: Saving with a taken username
- **WHEN** a user attempts to save an avatar with a username that already has an account
- **THEN** the system rejects the save and shows an error message asking for another username without losing the in-progress avatar

#### Scenario: Saving with an invalid username
- **WHEN** a user attempts to save an avatar with a blank or malformed username, or a password below the minimum length
- **THEN** the system shows a validation error and does not persist the avatar

#### Scenario: Logged-in user cannot create
- **WHEN** a user who is already logged in attempts to create a new buddy
- **THEN** the system rejects the creation and directs the user to log out first

## REMOVED Requirements

### Requirement: Ownership token
**Reason**: The claim-token ownership model is replaced by password accounts whose ownership is proven by logging in as that username.
**Migration**: Owners authenticate with username + password; edits are authorized by the authenticated account instead of a browser-held claim token.

## ADDED Requirements

### Requirement: Account ownership
The system SHALL treat the account authenticated for a username as that profile's owner. Avatar and mood edits SHALL require being logged in as that username, and the profile SHALL show edit controls only when the visitor is logged in as the owner.

#### Scenario: Owner edits their avatar
- **WHEN** the owner logged in as the profile's username opens the profile and changes the avatar parts
- **THEN** the system accepts the edit and re-renders the profile with the updated avatar

#### Scenario: Non-owner cannot edit
- **WHEN** a visitor who is not logged in as the profile's username attempts to edit the profile
- **THEN** the system shows no edit controls and rejects any direct edit request for that profile