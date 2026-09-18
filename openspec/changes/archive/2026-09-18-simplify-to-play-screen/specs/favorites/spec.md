## REMOVED Requirements

### Requirement: Viewing favorites
**Reason**: The viewing surface moves into the play screen's Friends tab, and the public profiles where favorite state was shown are removed.
**Migration**: The ADDED "Viewing friends" requirement below replaces this one.

## ADDED Requirements

### Requirement: Viewing friends
The owner SHALL be able to view their friends list from the play screen's Friends tab, and the tab SHALL show each friend with that friend's avatar and a control to poke them. Public profile pages are removed, so favorite state is no longer shown on another buddy's profile.

#### Scenario: Owner views their favorites
- **WHEN** the authenticated owner opens the Friends tab of the play screen
- **THEN** the tab lists the friends with their avatars and a poke control for each

#### Scenario: Unauthenticated access to favorites is rejected
- **WHEN** a request for an owner's friends list is made without an authenticated session
- **THEN** the system rejects the request

#### Scenario: Favorite state shown on a profile
- **WHEN** the owner is composing a list of buddies to poke
- **THEN** the Friends tab indicates whether a buddy is already in the owner's friends list and offers to add or remove them

## MODIFIED Requirements

### Requirement: Favorites list
Each profile SHALL have a list of friend buddy usernames — previously called "favorites" — persisted with the profile on the server. The list SHALL be empty when a profile is created and SHALL only be modified by the profile's owner using their authenticated session.

#### Scenario: New profile starts with no favorites
- **WHEN** a profile is created
- **THEN** its friends list is empty

### Requirement: Adding a favorite
The owner of a profile SHALL be able to add an existing buddy to their friends list by typing that buddy's username in the play screen's Friends tab. The system MUST require the owner's authenticated session to add a friend.

#### Scenario: Owner adds a favorite
- **WHEN** the authenticated owner requests to add an existing buddy's username in the Friends tab
- **THEN** the system adds that buddy's username to the owner's friends list

#### Scenario: Favoriting an already-favorited buddy
- **WHEN** the owner adds a buddy who is already in their friends list
- **THEN** the friends list stays unchanged and the operation does not error

#### Scenario: Favoriting a non-existent buddy
- **WHEN** the owner tries to add a username that has no account
- **THEN** the system rejects the request and the friends list is unchanged

#### Scenario: Unauthenticated add is rejected
- **WHEN** a request to add a friend is made without an authenticated session
- **THEN** the system rejects the request and the friends list is unchanged

### Requirement: Removing a favorite
The owner of a profile SHALL be able to remove a buddy from their friends list. The system MUST require the owner's authenticated session to remove a friend.

#### Scenario: Owner removes a favorite
- **WHEN** the authenticated owner requests to remove a friend from the Friends tab
- **THEN** the system removes that buddy's username from the owner's friends list

#### Scenario: Unauthenticated removal is rejected
- **WHEN** a request to remove a friend is made without an authenticated session
- **THEN** the system rejects the request and the friends list is unchanged