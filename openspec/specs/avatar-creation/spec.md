# Avatar Creation Specification

## Purpose

Lets users compose and save a unique avatar by combining visual body parts and colors, using original artwork that recreates the playful Buddy Poke style.

## Requirements

### Requirement: Avatar composition
The system SHALL let users build an avatar by selecting from visual part categories (head shape, eyes, mouth/expression, accessories, background/outfit colors) and SHALL render a live preview on the builder page. Successfully selected parts MUST combine into a single reproducible avatar image defined as inline SVG so it can be rendered identically on profiles and embed widgets.

#### Scenario: Building an avatar shows a live preview
- **WHEN** a user selects a head shape, eyes, mouth, and accessory on the builder page
- **THEN** the system immediately updates the live avatar preview with the selected parts without reloading the page

#### Scenario: Selecting a category changes available options
- **WHEN** a user picks a specific part category (e.g. eyes)
- **THEN** the system shows only the options valid for that category and highlights the currently selected option

### Requirement: Saving an avatar requires a username
The system SHALL require a unique, non-empty username to save an avatar. The system MUST persist the avatar composition and associate it with the username, and the user MUST be directed to a confirmation with a link to their public profile.

#### Scenario: Saving an avatar with a new username
- **WHEN** a user with a valid, unique username saves their avatar
- **THEN** the system persists the avatar composition under that username and shows a confirmation with a link to the public profile page

#### Scenario: Saving with a taken username
- **WHEN** a user attempts to save an avatar with a username that already exists with a different ownership token
- **THEN** the system rejects the save and shows an error message asking for another username without losing the in-progress avatar

#### Scenario: Saving with an invalid username
- **WHEN** a user attempts to save an avatar with a blank or malformed username
- **THEN** the system shows a validation error and does not persist the avatar

### Requirement: Ownership token
The system SHALL issue a claim token when a username is first created, stored in the user's browser, and MUST require that token for subsequent avatar or mood edits on that profile. The profile SHALL show edit controls only when the browser holds the matching token.

#### Scenario: Returning owner edits their avatar
- **WHEN** the browser holding the profile's claim token opens the profile and changes the avatar parts
- **THEN** the system accepts the edit and re-renders the profile with the updated avatar

#### Scenario: Visitor without the token cannot edit
- **WHEN** a browser without the profile's claim token loads the profile
- **THEN** the system shows no edit controls and rejects any direct edit request for that profile

### Requirement: Original artwork only
All avatar part artwork and styling SHALL be original content shipped with the application. The system MUST NOT load, reference, or reproduce any asset from the original Buddy Poke product, and avatar rendering MUST NOT depend on any external image service.

#### Scenario: Avatar renders without external assets
- **WHEN** a profile page or widget renders an avatar
- **THEN** all visual elements resolve from the application's own original SVG/data, and no network request to a third-party or Buddy Poke asset source occurs