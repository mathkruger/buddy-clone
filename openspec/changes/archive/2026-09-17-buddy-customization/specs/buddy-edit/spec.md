## Purpose

Lets logged-in users edit their existing buddy from the `/create` page with all customization options available, following the buddylabs customization model where every visual option is exposed in a unified builder interface.

## ADDED Requirements

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
The builder SHALL expose every customization option available in the buddylabs renderer pipeline, including body material selections (skin tone, shirt length/color, belt, pant length), face atlas layers (spot, mouth, eye shadow, mask, eyes, brows, beard, glasses, mustache), hair/hat combos with cull regions, and props (rose, mic, sword, etc.). All options MUST be selectable in the picker interface.

#### Scenario: User selects body material options
- **WHEN** a user browses the customization panels
- **THEN** the system shows all body material categories (skin, shirt, pants, belt, etc.) with their available options and allows selection

#### Scenario: User selects face atlas layer options
- **WHEN** a user browses the face customization panels
- **THEN** the system shows all face atlas layers (spot, mouth, eye shadow, mask, eyes, brows, beard, glasses, mustache) and allows selection

#### Scenario: User selects hair/hat combos and props
- **WHEN** a user browses the accessory panels
- **THEN** the system shows all hair/hat combos and prop options with their cull regions properly handled

### Requirement: Editing updates the profile correctly
When an owner edits their buddy from `/create`, the profile page MUST reflect the updated avatar composition on the next load without requiring a page refresh of the profile itself.

#### Scenario: Edited avatar appears on profile
- **WHEN** an owner edits their buddy via `/create` and saves
- **THEN** subsequent visits to their profile page render the updated avatar composition

#### Scenario: Edit mode exit
- **WHEN** an owner finishes editing and navigates to their profile
- **THEN** the profile shows the newly edited avatar