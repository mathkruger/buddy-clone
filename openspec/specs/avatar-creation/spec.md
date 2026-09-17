# Avatar Creation Specification

## Purpose

Lets users compose and save a unique avatar by combining visual body parts and colors, using original artwork that recreates the playful Buddy Poke style. The builder now supports all buddylabs customization options and serves as the unified page for both creating and editing buddies.

## Requirements

### Requirement: Avatar composition
The system SHALL let users compose an avatar by selecting from every catalog-backed visual part category shipped with the authentic buddylabs assets. The canonical composition schema is a single object with exactly these fields: `hair` (hair/hat mesh catalog item), `eyes` (eye sprite family), `mouth` (mouth-frame name), `props` (Props-catalog item or `none`), `skirt` (Skrt-catalog item), `clothing` (body-material layer selections keyed by manifest layer name: sock length/pattern, pant length/pattern/pattern2, shirt length/layer1/layer2, shoe/design/laces/sole, glove, belt/pattern), `face` (`spot`, `eyeShadow`, `mask`, `brows`, `glasses`, `mustache`, `beard` — each a shipped symbol name or off), `colors` (`skin`, `eye`, `hair`, `shirt`, `pants`, `socks`, `shoes`, `belt`, `glove`), and `hairMaterial` (`patternIndex`, `patternColor`, `streakIndex`, `streakColor`). The system SHALL render a live preview on the builder page from the vendored assets, and SHALL NOT use the placeholder fields `accent`, `bg`, `head`, `accessory`, `body`, or the hand-drawn `spot`/`eyeShadow`/`mask`/`brows`/`beard`/`glasses`/`mustache` frame names. Every option the builder exposes MUST combine into a single reproducible avatar image rendered identically on profiles and embed widgets.

#### Scenario: Building an avatar shows a live preview
- **WHEN** a user selects a hair style, eyes, mouth, and props on the builder page
- **THEN** the system immediately updates the live avatar preview with the selected parts without reloading the page

#### Scenario: Building an avatar with all options shows a live preview
- **WHEN** a user selects any combination of hair, eyes, mouth, props, skirt, face layers, and color/hair-material options on the builder page
- **THEN** the system immediately updates the live avatar preview with all selected parts rendered from vendored assets without reloading the page

#### Scenario: Building an avatar for editing shows a live preview
- **WHEN** a logged-in user selects hair, eyes, mouth, props, skirt, body-material layers, face layers, and colors on the builder page while editing
- **THEN** the system immediately updates the live avatar preview with all selected parts without reloading the page

#### Scenario: Selecting a category changes available options
- **WHEN** a user picks a specific part category (e.g. shoe design or hair pattern)
- **THEN** the system shows only the catalog-backed options valid for that category and highlights the currently selected option

#### Scenario: Obsolete fields are reset
- **WHEN** a composition contains `accent`, `bg`, `head`, `accessory`, `body`, or hand-drawn face-layer values
- **THEN** those fields are removed and the affected categories are reset to their defaults without failing save

#### Scenario: Rendering uses original shipped assets
- **WHEN** a page renders an avatar
- **THEN** every visual element resolves from the vendored asset files under `buddylabs/` (or the SVG fallback of the same composition), with no network request to the MinePoke site or any other third-party source, and no hand-drawn placeholder artwork is used as a primary visual

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

### Requirement: Original artwork only
All avatar part artwork and styling SHALL be original content shipped with the application. The system MUST NOT load, reference, or reproduce any asset from the original Buddy Poke product, and avatar rendering MUST NOT depend on any external image service.

#### Scenario: Avatar renders without external assets
- **WHEN** a profile page or widget renders an avatar
- **THEN** all visual elements resolve from the application's own original SVG/data, and no network request to a third-party or Buddy Poke asset source occurs

### Requirement: All buddylabs customization options exposed
The system SHALL expose every customization option available in the vendored buddylabs asset catalogs within the avatar builder: body material selections (skin tone, shirt length/color/layers, pant length/color/patterns, sock, shoe design/color, glove, belt), face atlas layers (spot, mouth, eye shadow, mask, eyes, brows, beard, glasses, mustache), hair/hat combos with their cull regions, skirt catalog items, and Props-catalog items (rose, mic, sword, and any other shipped prop). Options that reference assets not shipped (pending/unavailable catalog entries) SHALL NOT appear. Every exposed option SHALL be rendered from the shared vendored assets in both the picker thumbnails and the live preview.

#### Scenario: User selects body material options
- **WHEN** a user browses the customization panels
- **THEN** the system shows the skin, shirt, pants, socks, shoes, gloves, and belt categories with their catalog-backed options and allows selection, and the preview reflects the selection

#### Scenario: User selects face atlas layer options
- **WHEN** a user browses the face customization panels
- **THEN** the system shows the spot, mouth, eye shadow, mask, eyes, brows, beard, glasses, and mustache layers with their shipped symbol options and allows selection, and the preview reflects the selection

#### Scenario: User selects hair/hat combos and props
- **WHEN** a user browses the hair/hat and props categories
- **THEN** the system shows the shipped Hair and Props catalog items (with cull regions handled) and allows selection, and the preview reflects the selection

#### Scenario: Picker thumbnails use authentic assets
- **WHEN** the builder renders an option thumbnail
- **THEN** the thumbnail is generated from the shared vendored asset for that option, falling back to the placeholder snippet only while WebGL is unavailable or the thumbnail is still painting

#### Scenario: Unsupported options are not shown
- **WHEN** an asset catalog does not ship an asset referenced by an option
- **THEN** the builder does not show that option in its picker
