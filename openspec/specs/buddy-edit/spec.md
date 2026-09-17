# buddy-edit Specification

## Purpose
Lets logged-in users edit their existing buddy from the `/create` page with all customization options available, following the buddylabs customization model where every visual option is exposed in a unified builder interface.

## Requirements

### Requirement: Create page supports editing existing buddies
The system SHALL allow a logged-in user to visit `/create` and edit their existing buddy's avatar using the same builder interface used for creating new buddies. The builder MUST pre-populate with the existing buddy's avatar composition and colors.

#### Scenario: Logged-in user edits their buddy
- **WHEN** a logged-in user visits `/create`
- **THEN** the system loads their existing buddy's avatar composition and renders it in the builder preview, with all customization options pre-selected to match the current avatar

#### Scenario: Logged-out user sees create flow
- **WHEN** a visitor who is not logged in visits `/create`
- **THEN** the system shows the standard create-a-new-buddy flow unchanged

#### Scenario: User saves edited buddy
- **WHEN** an editing user modifies their avatar and submits the form
- **THEN** the system updates the existing profile's avatar composition and persists the change

### Requirement: All buddylabs customization options exposed
The builder SHALL expose every catalog-backed customization option available in the vendored buddylabs asset catalogs in the editor, including body material selections (skin tone, shirt length/color/layers, pant length/color/patterns, sock, shoe design/color, glove, belt), face atlas layers (spot, mouth, eye shadow, mask, eyes, brows, beard, glasses, mustache), hair/hat combos with their cull regions, skirt catalog items, and Props-catalog items. All options MUST be selectable in the picker interface, MUST be pre-populated from the stored canonical composition, and MUST be rendered from vendored assets in the editor preview. Obsolete stored fields (`accent`, `bg`, `head`, `accessory`, `body`, hand-drawn face-layer values) MUST be reset to defaults when the editor loads a composition.

#### Scenario: User selects body material options
- **WHEN** a user browses the customization panels while editing
- **THEN** the system shows the skin, shirt, pants, socks, shoes, gloves, and belt categories with their catalog-backed options and allows selection, and the preview reflects the selection

#### Scenario: User selects face atlas layer options
- **WHEN** a user browses the face customization panels while editing
- **THEN** the system shows the spot, mouth, eye shadow, mask, eyes, brows, beard, glasses, and mustache layers with their shipped symbol options and allows selection, and the preview reflects the selection

#### Scenario: User selects hair/hat combos and props
- **WHEN** a user browses the hair/hat and props categories while editing
- **THEN** the system shows the shipped Hair and Props catalog items (with cull regions handled) and allows selection, and the preview reflects the selection

#### Scenario: Editor loads the stored composition
- **WHEN** an owner opens the editor for an existing buddy
- **THEN** the pickers, colors, and preview are pre-populated from the stored canonical composition, and any obsolete stored fields are reset to their defaults without failing the editor

#### Scenario: Picker thumbnails use authentic assets
- **WHEN** the editor renders an option thumbnail
- **THEN** the thumbnail is generated from the shared vendored asset for that option, falling back to the placeholder snippet only while WebGL is unavailable or the thumbnail is still painting

#### Scenario: Unsupported options are not shown
- **WHEN** an asset catalog does not ship an asset referenced by an option
- **THEN** the editor does not show that option in its picker

### Requirement: Editing updates the profile correctly
When an owner edits their buddy from `/create`, the profile page MUST reflect the updated avatar composition on the next load without requiring a page refresh of the profile itself.

#### Scenario: Edited avatar appears on profile
- **WHEN** an owner edits their buddy via `/create` and saves
- **THEN** subsequent visits to their profile page render the updated avatar composition

#### Scenario: Edit mode exit
- **WHEN** an owner finishes editing and navigates to their profile
- **THEN** the profile shows the newly edited avatar
