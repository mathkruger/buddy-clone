## ADDED Requirements

### Requirement: Simple default appearance
New accounts SHALL be created with the simplest predefined default appearance: the plain base look with default hair, eyes, and mouth and no hat, clothing, shoes, skirt, props, or face extras. The Appearance tab SHALL start from and allow changing this look.

#### Scenario: Registration applies the default appearance
- **WHEN** a new account is registered
- **THEN** the buddy is created with the simple default appearance

#### Scenario: The default look is a valid editable composition
- **WHEN** the Appearance tab loads for a new account
- **THEN** the options reflect the simple default composition and the stage renders it without errors

## MODIFIED Requirements

### Requirement: Avatar composition
The system SHALL let the owner compose their buddy's appearance from every catalog-backed visual part category shipped with the authentic buddylabs assets, now through the play screen's Appearance tab. The canonical composition schema is unchanged: a single object with exactly these fields — `hair` (hair/hat mesh catalog item), `eyes` (eye sprite family), `mouth` (mouth-frame name), `props` (Props-catalog item or `none`), `skirt` (Skrt-catalog item), `clothing` (body-material layer selections keyed by manifest layer name), `face` (`spot`, `eyeShadow`, `mask`, `brows`, `glasses`, `mustache`, `beard` — each a shipped symbol name or off), `colors` (`skin`, `eye`, `hair`, `shirt`, `pants`, `socks`, `shoes`, `belt`, `glove`), and `hairMaterial` (`patternIndex`, `patternColor`, `streakIndex`, `streakColor`). The system SHALL render a live preview on the play screen's stage from the vendored assets, and SHALL NOT use the placeholder fields `accent`, `bg`, `head`, `accessory`, `body`, or hand-drawn face-layer frame names. Every option the Appearance tab exposes MUST combine into a single reproducible avatar image rendered identically on the play screen and the embed widget.

#### Scenario: Building an avatar shows a live preview
- **WHEN** the owner selects a hair style, eyes, mouth, and props in the Appearance tab
- **THEN** the system immediately updates the live stage with the selected parts without reloading the page

#### Scenario: Building an avatar with all options shows a live preview
- **WHEN** the owner selects any combination of hair, eyes, mouth, props, skirt, face layers, and color/hair-material options in the Appearance tab
- **THEN** the system immediately updates the live stage with all selected parts rendered from vendored assets without reloading the page

#### Scenario: Building an avatar for editing shows a live preview
- **WHEN** a logged-in user selects parts while editing their existing buddy in the Appearance tab
- **THEN** the system immediately updates the live stage with all selected parts without reloading the page

#### Scenario: Selecting a category changes available options
- **WHEN** the owner picks a specific part category (e.g. shoe design or hair pattern)
- **THEN** the tab shows only the catalog-backed options valid for that category and highlights the currently selected option

#### Scenario: Obsolete fields are reset
- **WHEN** a composition contains `accent`, `bg`, `head`, `accessory`, `body`, or hand-drawn face-layer values
- **THEN** those fields are removed and the affected categories are reset to their defaults without failing save

#### Scenario: Rendering uses original shipped assets
- **WHEN** a page renders an avatar
- **THEN** every visual element resolves from the vendored asset files under `buddylabs/` (or the SVG fallback of the same composition), with no network request to the MinePoke site or any other third-party source, and no hand-drawn placeholder artwork is used as a primary visual

### Requirement: Ownership token
The system SHALL require an authenticated session for avatar and appearance edits; ownership is demonstrated by being logged in as that profile's username. The Appearance tab SHALL be available only to the logged-in owner, and editing SHALL be validated against the authenticated session when the Appearance tab loads.

#### Scenario: Returning owner edits their avatar
- **WHEN** the logged-in owner opens the Appearance tab in the play screen
- **THEN** the system accepts the edit and re-renders the stage with the updated avatar on the next visit

#### Scenario: Visitor without the token cannot edit
- **WHEN** a browser without an authenticated session for the profile requests an appearance change
- **THEN** the system shows the login flow instead of the Appearance tab and the request is rejected

### Requirement: All buddylabs customization options exposed
The system SHALL expose every customization option available in the vendored buddylabs asset catalogs within the Appearance tab: body material selections (skin tone, shirt length/color/layers, pant length/color/patterns, sock, shoe design/color, glove, belt), face atlas layers (spot, mouth, eye shadow, mask, eyes, brows, beard, glasses, mustache), hair/hat combos with their cull regions, skirt catalog items, and Props-catalog items (rose, mic, sword, and any other shipped prop). Options that reference assets not shipped (pending/unavailable catalog entries) SHALL NOT appear. Every exposed option SHALL be rendered from the shared vendored assets in both the picker thumbnails and the live stage.

#### Scenario: User selects body material options
- **WHEN** a user browses the Appearance body-material panels
- **THEN** the system shows the skin, shirt, pants, socks, shoes, gloves, and belt categories with their catalog-backed options and allows selection, and the stage reflects the selection

#### Scenario: User selects face atlas layer options
- **WHEN** a user browses the Appearance face panels
- **THEN** the system shows the spot, mouth, eye shadow, mask, eyes, brows, beard, glasses, and mustache layers with their shipped symbol options and allows selection, and the stage reflects the selection

#### Scenario: User selects hair/hat combos and props
- **WHEN** a user browses the hair/hat and props categories in the Appearance tab
- **THEN** the system shows the shipped Hair and Props catalog items (with cull regions handled) and allows selection, and the stage reflects the selection

#### Scenario: Picker thumbnails use authentic assets
- **WHEN** the Appearance tab renders an option thumbnail
- **THEN** the thumbnail is generated from the shared vendored asset for that option, falling back to the placeholder snippet only while WebGL is unavailable or the thumbnail is still painting

#### Scenario: Unsupported options are not shown
- **WHEN** an asset catalog does not ship an asset referenced by an option
- **THEN** the Appearance tab does not show that option in its picker

## REMOVED Requirements

### Requirement: Create page supports editing existing buddies
**Reason**: The standalone `/create` page and its builder are replaced by the play screen's Appearance tab.
**Migration**: Editing an existing buddy happens in the Appearance tab, which pre-populates the stored composition and saves through the standard avatar endpoint.