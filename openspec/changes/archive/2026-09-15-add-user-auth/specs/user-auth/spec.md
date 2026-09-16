## Purpose

Provides real accounts for the app: buddies are registered with a password that the server verifies, sessions are issued as JWTs carried in an HttpOnly cookie and a bearer header, and every protected action can identify who is acting.

## ADDED Requirements

### Requirement: Account creation
Creating a buddy SHALL require a unique username and a password. The password MUST be accepted only when it satisfies the minimum length policy, and MUST NOT be stored or returned in plaintext. A successful creation SHALL return the new profile and start an authenticated session for the creator.

#### Scenario: Creating an account starts a session
- **WHEN** a visitor creates a buddy with a valid, unique username and a password that meets the minimum length policy
- **THEN** the system returns the created profile, establishes an authenticated session for that username, and the creator can access owner-only features immediately

#### Scenario: Too-short password is rejected
- **WHEN** a visitor attempts to create a buddy with a password shorter than the minimum length
- **THEN** the system rejects the creation and does not persist a profile

#### Scenario: Creation never leaks the password
- **WHEN** a buddy is created
- **THEN** the response contains no password or password hash in any form

### Requirement: Password storage
The system SHALL store each account password as a salted hash using a strong password-hashing algorithm and SHALL compare logins against the stored hash, never against a recoverable stored password. No response SHALL expose the stored hash.

#### Scenario: Password hash is not exposed
- **WHEN** any API returns a profile or account payload
- **THEN** the response does not include the password hash

### Requirement: Login
The system SHALL provide a login endpoint that accepts a username and password, verifies them against the stored password hash, and on success issues a JWT identifying the authenticated user. The endpoint SHALL return the same outcome for an unknown username and a wrong password so the existence of an account cannot be discovered.

#### Scenario: Correct credentials log a user in
- **WHEN** a user submits their username and the correct password
- **THEN** the system issues a JWT identifying that user and establishes a session

#### Scenario: Wrong password is rejected
- **WHEN** a user submits a valid username and an incorrect password
- **THEN** the system rejects the login with a generic credential error

#### Scenario: Unknown username is rejected indistinguishably
- **WHEN** a user submits a username that has no account
- **THEN** the system rejects the login with the same generic credential error as a wrong password

### Requirement: Authenticated session delivery
The system SHALL make the JWT available both as an HttpOnly cookie set on login and as a bearer credential accepted on API requests. Requests that present either a valid cookie or a valid bearer JWT SHALL be treated as the authenticated user whose identity is encoded in the token.

#### Scenario: Cookie authenticates page and API requests
- **WHEN** a request carries the session cookie issued at login
- **THEN** the server recognizes the request as the authenticated user

#### Scenario: Bearer token authenticates API requests
- **WHEN** an API request carries the JWT in an Authorization Bearer header
- **THEN** the server recognizes the request as the authenticated user without a cookie

### Requirement: Session identity endpoint
The system SHALL provide an endpoint that returns the current authenticated user when a valid session is presented and an anonymous response when it is not, so the client can determine login state.

#### Scenario: Authenticated session reports the user
- **WHEN** a client with a valid session requests the current user
- **THEN** the system returns that user's username

#### Scenario: Anonymous request reports no user
- **WHEN** a client without a valid session requests the current user
- **THEN** the system returns an anonymous response

### Requirement: Logout
The system SHALL provide a logout action that clears the session cookie so the browser is no longer authenticated. After logout, protected requests SHALL be treated as anonymous.

#### Scenario: Logging out ends the session
- **WHEN** an authenticated user logs out
- **THEN** the session cookie is cleared and subsequent requests from that browser are anonymous

### Requirement: Token validity and expiry
Issued JWTs SHALL be signed and verified on every authenticated request, SHALL carry an expiry, and SHALL be rejected once expired. An invalid, expired, or malformed token SHALL be treated as no session at all.

#### Scenario: Expired token is treated as anonymous
- **WHEN** a request presents a JWT whose expiry has passed
- **THEN** the server treats the request as anonymous and grants no protected access

#### Scenario: Tampered token is treated as anonymous
- **WHEN** a request presents a JWT that does not verify
- **THEN** the server treats the request as anonymous and grants no protected access