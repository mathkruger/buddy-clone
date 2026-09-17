## MODIFIED Requirements

### Requirement: Avatar composition
The system SHALL let users build an avatar by selecting from visual part categories (hair style, eyes, mouth/expression, accessories, and colors) using authentic Buddy Poke artwork, and SHALL render a live preview on the builder page. Successfully selected parts MUST combine into a single reproducible avatar rendered identically on the builder preview, profiles, and embed widgets.

#### Scenario: Building an avatar shows a live preview
- **WHEN** a user selects a hair style, eyes, mouth, and accessory on the builder page
- **THEN** the system immediately updates the live avatar preview with the selected parts without reloading the page

#### Scenario: Selecting a category changes available options
- **WHEN** a user picks a specific part category (e.g. eyes)
- **THEN** the system shows only the options valid for that category and highlights the currently selected option

## REMOVED Requirements

### Requirement: Original artwork only
**Reason**: Replaced by the authentic Buddy Poke asset set (from the MinePoke reconstruction), which the project now renders instead of hand-drawn original artwork.
**Migration**: The hand-drawn SVG artwork is removed from the rendering pipeline. Profiles persist unchanged in the same `avatarDef` JSON shape; part values from the old vocabulary that do not map to the authentic set reset to the default part of their category when rendered.

## ADDED Requirements

### Requirement: Self-contained authentic artwork
All avatar part artwork and styling SHALL be authentic Buddy Poke assets bundled with the application. Avatar rendering MUST NOT depend on any runtime network request to an external or third-party asset source.

#### Scenario: Avatar renders fully offline
- **WHEN** a profile page or widget renders an avatar
- **THEN** all visual elements resolve from the application's own bundled assets, and no network request to a third-party or Buddy Poke asset source occurs