## MODIFIED Requirements

### Requirement: Avatar composition
The system SHALL let users build an avatar by selecting from visual part categories (hair style, eyes, mouth/expression, accessory, background/outfit colors) and SHALL render a live preview on the builder page. Successfully selected parts MUST combine into a single reproducible avatar rendered in 3D by the shared avatar renderer, so a saved composition displays identically on profiles and embed widgets.

#### Scenario: Building an avatar shows a live preview
- **WHEN** a user selects a hair style, eyes, mouth, and accessory on the builder page
- **THEN** the system immediately updates the live avatar preview with the selected parts without reloading the page

#### Scenario: Selecting a category changes available options
- **WHEN** a user picks a specific part category (e.g. eyes)
- **THEN** the system shows only the options valid for that category and highlights the currently selected option

### Requirement: Original artwork only
All avatar part artwork and styling SHALL be original content shipped with the application. The system MUST NOT load, reference, or reproduce any asset from the original Buddy Poke product, and avatar rendering MUST NOT depend on any external image or asset service.

#### Scenario: Avatar renders without external assets
- **WHEN** a profile page or widget renders an avatar
- **THEN** all visual elements (SVG part stickers and the 3D model) resolve from the application's own original SVG and 3D data, and no network request to a third-party or Buddy Poke asset source occurs