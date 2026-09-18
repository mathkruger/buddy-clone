## MODIFIED Requirements

### Requirement: Create page supports editing existing buddies
The system SHALL allow a logged-in user to edit their existing buddy's appearance from the play screen's Appearance tab, replacing the old `/create` editor. The tab MUST pre-populate with the existing buddy's avatar composition and colors.

#### Scenario: Logged-in user edits their buddy
- **WHEN** a logged-in user opens the Appearance tab in the play screen
- **THEN** the system loads their existing buddy's avatar composition and renders it on the stage, with all customization options pre-selected to match the current avatar

#### Scenario: Logged-out user sees create flow
- **WHEN** a visitor who is not logged in opens the play screen
- **THEN** the system redirects them to the login screen; there is no standalone create page anymore

#### Scenario: User saves edited buddy
- **WHEN** an editing user modifies their appearance and saves
- **THEN** the system updates the existing profile's avatar composition and persists the change

### Requirement: All buddylabs customization options exposed
The builder SHALL expose every catalog-backed customization option available in the vendored buddylabs asset catalogs in the Appearance tab, including body material selections (skin tone, shirt length/color/layers, pant length/color/patterns, sock, shoe design/color, glove, belt), face atlas layers (spot, mouth, eye shadow, mask, eyes, brows, beard, glasses, mustache), hair/hat combos with their cull regions, skirt catalog items, and Props-catalog items. All options MUST be selectable in the picker interface, MUST be pre-populated from the stored canonical composition, and MUST be rendered from vendored assets in the play screen stage. Obsolete stored fields (`accent`, `bg`, `head`, `accessory`, `body`, hand-drawn face-layer values) MUST be reset to defaults when a composition is loaded.

#### Scenario: User selects body material options
- **WHEN** a user browses the customization panels in the Appearance tab
- **THEN** the system shows the skin, shirt, pants, socks, shoes, gloves, and belt categories with their catalog-backed options and allows selection, and the stage reflects the selection

#### Scenario: User selects face atlas layer options
- **WHEN** a user browses the face customization panels in the Appearance tab
- **THEN** the system shows the spot, mouth, eye shadow, mask, eyes, brows, beard, glasses, and mustache layers with their shipped symbol options and allows selection, and the stage reflects the selection

#### Scenario: User selects hair/hat combos and props
- **WHEN** a user browses the hair/hat and props categories in the Appearance tab
- **THEN** the system shows the shipped Hair and Props catalog items (with cull regions handled) and allows selection, and the stage reflects the selection

#### Scenario: Editor loads the stored composition
- **WHEN** an owner opens the Appearance tab for an existing buddy
- **THEN** the pickers, colors, and stage are pre-populated from the stored canonical composition, and any obsolete stored fields are reset to their defaults without failing the editor

#### Scenario: Picker thumbnails use authentic assets
- **WHEN** the Appearance tab renders an option thumbnail
- **THEN** the thumbnail is generated from the shared vendored asset for that option, falling back to the placeholder snippet only while WebGL is unavailable or the thumbnail is still painting

#### Scenario: Unsupported options are not shown
- **WHEN** an asset catalog does not ship an asset referenced by an option
- **THEN** the Appearance tab does not show that option in its picker

## REMOVED Requirements

### Requirement: Editing updates the profile correctly
**Reason**: There is no public profile page anymore; the result of an edit is shown on the play screen's stage instead.
**Migration**: The ADDED "Appearance edits update the stage" requirement below covers the new destination.

## ADDED Requirements

### Requirement: Appearance edits update the stage
When an owner edits their buddy from the Appearance tab, the play screen MUST reflect the updated avatar composition immediately and on subsequent loads.

#### Scenario: Edited avatar appears on profile
- **WHEN** an owner edits their buddy via the Appearance tab and saves
- **THEN** the play screen stage renders the updated avatar composition

#### Scenario: Edit mode exit
- **WHEN** the owner finishes editing and returns to the stage
- **THEN** the stage shows the newly edited avatar, and later visits to the play screen show the same look