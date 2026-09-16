## Purpose

Provides a landing page that introduces the app and funnels visitors to buddy creation, a login page for returning owners to reach their own buddy, and buddy search.

## ADDED Requirements

### Requirement: Home page
The system SHALL serve a home page at the site root that introduces the app and provides prominent entry points to create a buddy, log in as a returning owner, and search for buddies.

#### Scenario: Home page shows entry points
- **WHEN** a visitor opens the site root
- **THEN** the page shows a landing layout with links to create a buddy, to log in as a returning owner, and to search buddies

#### Scenario: Create link leads to the builder
- **WHEN** a visitor follows the create-a-buddy link from the home page
- **THEN** they are taken to the buddy creation page with the avatar builder

### Requirement: Buddy creation page
The avatar builder SHALL be available on its own page, separate from the home page, so the home page is not the builder.

#### Scenario: Builder is reachable from home
- **WHEN** a visitor navigates to the buddy creation page
- **THEN** the avatar builder loads with the live preview, part pickers, and save form

### Requirement: Login page
The system SHALL provide a login page where a user enters a username. If the browser holds the claim token for that username, the system SHALL redirect the user to that profile. Otherwise the system SHALL show the user that the profile is not theirs and guide them toward creating a buddy.

#### Scenario: Returning owner logs in
- **WHEN** a returning owner enters their username on the login page and the browser holds that profile's claim token
- **THEN** the system redirects them to their own buddy's profile page

#### Scenario: Username without a token
- **WHEN** a visitor enters a username for which the browser holds no claim token
- **THEN** the system shows a message that the profile is not theirs and a path to create a new buddy, and does not grant any edit access

#### Scenario: Unknown username
- **WHEN** a visitor enters a username that has no profile
- **THEN** the system indicates the profile does not exist and shows a path to create that buddy