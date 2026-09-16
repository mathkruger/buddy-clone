## MODIFIED Requirements

### Requirement: Login page
The system SHALL provide a login page where a user enters their username and password. The page SHALL submit the credentials to the auth API and, on success, SHALL redirect the user to their own profile. On failure, the page SHALL show a generic credential error without revealing whether the username exists. A user who is already logged in SHALL be redirected to their own profile instead of the login page.

#### Scenario: Returning owner logs in
- **WHEN** a returning owner enters their username and correct password on the login page
- **THEN** the system logs them in and redirects them to their own buddy's profile page

#### Scenario: Username without a token
- **WHEN** a user attempts to log in with a password that does not match the account's stored hash
- **THEN** the system shows a generic credential error, grants no session, and reveals no account details

#### Scenario: Unknown username
- **WHEN** a user enters a username that has no account
- **THEN** the system shows the same generic credential error as a wrong password

#### Scenario: Already logged in
- **WHEN** a user who already has a valid session opens the login page
- **THEN** the system redirects them to their own profile page