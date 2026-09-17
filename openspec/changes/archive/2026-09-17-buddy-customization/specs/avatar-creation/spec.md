## ADDED Requirements

### Requirement: All buddylabs customization options exposed
The system SHALL expose every customization option available in the buddylabs renderer pipeline within the avatar builder, including body material selections (skin tone, shirt length/color, belt, pant length), face atlas layers (spot, mouth, eye shadow, mask, eyes, brows, beard, glasses, mustache), hair/hat combos with cull regions, and props (rose, mic, sword, etc.).

#### Scenario: User selects body material options
- **WHEN** a user browses the customization panels
- **THEN** the system shows all body material categories with their available options and allows selection

#### Scenario: User selects face atlas layer options
- **WHEN** a user browses the face customization panels
- **THEN** the system shows all face atlas layers and allows selection

#### Scenario: User selects hair/hat combos and props
- **WHEN** a user browses the accessory panels
- **THEN** the system shows all hair/hat combos and prop options with their cull regions properly handled

## REMOVED Requirements

### Requirement: Saving an avatar requires a username
**Reason**: When editing an existing buddy, the username is already established; the create page uses the existing profile identity
**Migration**: The edit flow in `/create` does not require a username input; it uses the logged-in user's username from the session

## MODIFIED Requirements

### Requirement: Avatar composition
The system SHALL let users compose an avatar by selecting from ALL visual part categories available in the buddylabs renderer pipeline (body materials, face atlas layers, hair/hat combos, props, colors) and SHALL render a live preview on the builder page. Successfully selected parts MUST combine into a single reproducible avatar image defined as inline SVG so it can be rendered identically on profiles and embed widgets.

#### Scenario: Building an avatar shows a live preview
- **WHEN** a user selects a head shape, eyes, mouth, and accessory on the builder page
- **THEN** the system immediately updates the live avatar preview with the selected parts without reloading the page

#### Scenario: Building an avatar with all options shows a live preview
- **WHEN** a user selects any combination of body materials, face layers, hair/hat, and props on the builder page
- **THEN** the system immediately updates the live avatar preview with all selected parts without reloading the page

#### Scenario: Selecting a category changes available options
- **WHEN** a user picks a specific part category (e.g. shirt color or eye shadow style)
- **THEN** the system shows only the options valid for that category and highlights the currently selected option

#### Scenario: Building an avatar for editing shows a live preview
- **WHEN** a logged-in user selects head shape, eyes, mouth, accessory, body materials, face layers, and props on the builder page while editing
- **THEN** the system immediately updates the live avatar preview with all selected parts without reloading the page

### Requirement: Create page supports editing existing buddies
The system SHALL allow a logged-in user to visit `/create` and edit their existing buddy's avatar using the same builder interface. The builder SHALL pre-populate with the existing buddy's avatar composition and colors.

#### Scenario: Logged-in user edits their buddy
- **WHEN** a logged-in user visits `/create`
- **THEN** the system loads their existing buddy's avatar composition and renders it in the builder preview with all customization options pre-selected to match the current avatar

#### Scenario: Logged-out user sees create flow
- **WHEN** a visitor who is not logged in visits `/create`
- **THEN** the system shows the standard create-a-new-buddy flow unchanged

#### Scenario: User saves edited buddy
- **WHEN** an editing user modifies their avatar and submits the form
- **THEN** the system updates the existing profile's avatar composition via PUT `/api/profile/:username`

### Requirement: Ownership token
The system SHALL issue a claim token when a username is first created, stored in the user's browser, and MUST require that token for subsequent avatar or mood edits on that profile. The profile SHALL show edit controls only when the browser holds the matching token. For avatar editing, the claim token is validated when the user accesses `/create` in edit mode.

#### Scenario: Returning owner edits their avatar
- **WHEN** the browser holding the profile's claim token opens `/create` in edit mode
- **THEN** the system accepts the edit and re-renders the profile with the updated avatar on the next visit

#### Scenario: Visitor without the token cannot edit
- **WHEN** a browser without the profile's claim token loads `/create`
- **THEN** the system shows the standard create-a-new-buddy flow instead of the edit mode