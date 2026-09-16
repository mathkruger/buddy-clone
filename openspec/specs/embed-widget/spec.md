# Embed Widget Specification

## Purpose

Generates embeddable HTML snippets that let users display their avatar and current mood on external pages such as blogs and forums, mirroring the original Buddy Poke share feature.

## Requirements

### Requirement: Embed snippet generation
The system SHALL provide a page (or section) where the owner of a profile can copy an embeddable HTML snippet for their avatar and mood. The snippet SHALL be self-contained and reference only the application's own assets and endpoints.

#### Scenario: Generating an embed snippet
- **WHEN** the profile owner opens the embed section for their profile
- **THEN** the system shows an HTML snippet they can copy that renders their avatar and current mood

### Requirement: Embed widget rendering
An embed widget SHALL render the target user's avatar with current mood inside an external page without requiring a visitor account, and SHALL include a link back to the user's public profile.

#### Scenario: Widget renders on an external page
- **WHEN** an external page includes the embed snippet and a visitor loads it
- **THEN** the widget renders the user's avatar with the current mood and a link to the profile

#### Scenario: Widget shows current mood
- **WHEN** the embed widget renders
- **THEN** it shows the same mood as the public profile at that moment

### Requirement: Mood stays up to date
The embed widget SHALL fetch the avatar and mood data from the server so that a mood change made by the owner is reflected when the widget loads, without requiring a new snippet.

#### Scenario: Widget reflects a recent mood change
- **WHEN** the owner changes their mood and an external visitor then loads a page with the previously installed snippet
- **THEN** the widget shows the updated mood and avatar without the owner re-copying the snippet

### Requirement: Embed isolation
The embed widget SHALL render inside a bounded area (e.g. an iframe) so it does not alter the layout or styles of the host page.

#### Scenario: Widget is contained
- **WHEN** the embed widget loads inside an external page
- **THEN** no cascading styles or scripts from the widget affect the host page's existing layout