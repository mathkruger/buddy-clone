# Site Navigation Specification

## Purpose

Provides a landing page that introduces the app and funnels visitors to buddy creation, a login page for returning owners to reach their own buddy, and buddy search.

## Requirements

### Requirement: Four-screen navigation
The system SHALL provide exactly four screens: a landing page, a register page, a login page, and the play screen. Anonymous users SHALL reach the play screen only by registering or logging in.

#### Scenario: Landing page shows register and login CTAs
- **WHEN** a visitor opens the site root
- **THEN** the landing page introduces the project and shows a CTA to register and a CTA to log in

#### Scenario: Register CTA leads to the register screen
- **WHEN** a visitor follows the register CTA
- **THEN** they are taken to the register screen where they provide only a username and a password

#### Scenario: Login CTA leads to the login screen
- **WHEN** a visitor follows the login CTA
- **THEN** they are taken to the login screen where they provide their username and password

### Requirement: Register screen
The system SHALL provide a register screen where a user creates an account by providing only a username and a password. Successful registration SHALL create the account and its buddy with the simple default appearance, log the user in, and take them to the play screen. A logged-in user requesting the register screen SHALL be redirected to the play screen.

#### Scenario: Registering a new account
- **WHEN** a visitor submits a new username and a password on the register screen
- **THEN** the system creates the account and its buddy with the default appearance, starts an authenticated session, and redirects to the play screen

#### Scenario: Registering a duplicate username
- **WHEN** a visitor submits a username that already exists
- **THEN** the system rejects the registration and the form shows an error

#### Scenario: Logged-in user opens the register screen
- **WHEN** an already logged-in user requests the register screen
- **THEN** the system redirects them to the play screen

### Requirement: Login screen
The system SHALL provide a login screen where a user supplies a username and a password. A successful login SHALL start an authenticated session and take the user to the play screen. A logged-in user requesting the login screen SHALL be redirected to the play screen.

#### Scenario: Logging in with valid credentials
- **WHEN** a visitor submits an existing username and the correct password on the login screen
- **THEN** the system starts an authenticated session and redirects to the play screen

#### Scenario: Logging in with wrong credentials
- **WHEN** a visitor submits an unknown username or a wrong password
- **THEN** the system rejects the login with a generic error and does not start a session

#### Scenario: Logged-in user opens the login screen
- **WHEN** an already logged-in user requests the login screen
- **THEN** the system redirects them to the play screen

### Requirement: Play screen is the authenticated destination
The play screen SHALL be the single destination for authenticated users of the app; from it the user manages pokes, friends, humor, and appearance. Logging out SHALL return the user to the landing page.

#### Scenario: Logged-in users land on the play screen
- **WHEN** an authenticated user logs in, registers, or otherwise needs the main surface of the app
- **THEN** the system takes them to the play screen

#### Scenario: Logging out returns to the landing page
- **WHEN** a user logs out
- **THEN** the session ends and the user is returned to the landing page