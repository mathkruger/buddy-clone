## MODIFIED Requirements

### Requirement: Favorites list
Each profile SHALL have a list of favorite buddy usernames persisted with the profile on the server. The list SHALL be empty when a profile is created and SHALL only be modified by the profile's owner while logged in as that username.

#### Scenario: New profile starts with no favorites
- **WHEN** a profile is created
- **THEN** its favorites list is empty

### Requirement: Adding a favorite
The owner of a profile SHALL be able to add an existing buddy to their favorites. The system MUST require the owner to be logged in as that username to add a favorite.

#### Scenario: Owner adds a favorite
- **WHEN** the owner logged in as the profile's username requests to favorite an existing buddy
- **THEN** the system adds that buddy's username to the profile's favorites list

#### Scenario: Favoriting an already-favorited buddy
- **WHEN** the owner favorites a buddy who is already in their favorites
- **THEN** the favorites list stays unchanged and the operation does not error

#### Scenario: Favoriting a non-existent buddy
- **WHEN** the owner tries to favorite a username that has no profile
- **THEN** the system rejects the request and the favorites list is unchanged

#### Scenario: Unauthenticated add is rejected
- **WHEN** a request to add a favorite is made without a valid session as the owner
- **THEN** the system rejects the request and the favorites list is unchanged

### Requirement: Removing a favorite
The owner of a profile SHALL be able to remove a buddy from their favorites. The system MUST require the owner to be logged in as that username to remove a favorite.

#### Scenario: Owner removes a favorite
- **WHEN** the owner logged in as the profile's username requests to remove a favorited buddy
- **THEN** the system removes that buddy's username from the profile's favorites list

#### Scenario: Unauthenticated removal is rejected
- **WHEN** a request to remove a favorite is made without a valid session as the owner
- **THEN** the system rejects the request and the favorites list is unchanged

### Requirement: Viewing favorites
The owner SHALL be able to view their favorites list, and the system SHALL show the owner whether a buddy is already favorited when they visit that buddy's profile. A user SHALL only be able to view the favorites of the account they are logged in as.

#### Scenario: Owner views their favorites
- **WHEN** the owner logged in as the profile's username opens their favorites view
- **THEN** the view lists the favorited buddies with their avatars and links to their profiles

#### Scenario: Unauthenticated access to favorites is rejected
- **WHEN** a request for an owner's favorites list is made without a valid session as that owner
- **THEN** the system rejects the request

#### Scenario: Favorite state shown on a profile
- **WHEN** the owner visits another buddy's profile
- **THEN** the page indicates whether that buddy is already in the owner's favorites and offers to add or remove them