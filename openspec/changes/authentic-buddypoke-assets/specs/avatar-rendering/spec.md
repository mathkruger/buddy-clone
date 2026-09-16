## Purpose

Renders avatars from their stored composition using authentic Buddy Poke meshes, composited texture atlases, and skeletal animations, fully offline in the browser.

## ADDED Requirements

### Requirement: Offline authentic rendering
The system SHALL render an avatar from its stored composition using bundled authentic Buddy Poke geometry, composited texture atlases, and skeletal animations, entirely in the browser, and MUST NOT fetch any asset from an external source at render time.

#### Scenario: Avatar renders from stored composition
- **WHEN** a profile page, builder preview, or widget has an avatar composition
- **THEN** the avatar is drawn entirely from locally bundled meshes, atlases, and animations without any external network request

#### Scenario: Composition changes re-render without reload
- **WHEN** a part or color of a composition changes on the builder
- **THEN** the avatar re-renders in place with the new part without reloading the page

### Requirement: Stored composition compatibility
Every stored avatarDef composition SHALL render on builder previews, profile pages, and embed widgets. Part values introduced by the previous hand-drawn vocabulary that do not map to the authentic asset set SHALL reset to the default part of their category instead of failing to render.

#### Scenario: Legacy part value resets to default
- **WHEN** a stored avatar contains a part value with no authentic counterpart (e.g. an old head shape or accessory)
- **THEN** that part renders as the category's default authentic option and the avatar still renders

#### Scenario: Current vocabulary renders faithfully
- **WHEN** a stored avatar uses authentic part values
- **THEN** each part renders as its selected hair mesh, eye sprite, mouth frame, or accessory

### Requirement: Mood and interaction animations
Mood and interaction playback SHALL drive the avatar with authentic skeletal animations bundled with the application, and SHALL keep the face material (mouth frames) synchronized with the animation timeline.

#### Scenario: Mood plays a skeletal animation
- **WHEN** a profile's mood is displayed or changed
- **THEN** the avatar plays the bundled skeletal animation mapped to that mood, looping while idle

#### Scenario: Interaction plays on the staged scene
- **WHEN** an interaction is triggered on a profile
- **THEN** the sender and target avatars play the bundled skeletal animations mapped to that interaction on the staged scene

#### Scenario: Mouth follows the animation timeline
- **WHEN** an animation plays
- **THEN** the avatar's mouth material switches to the frame channel defined for that animation at each frame

### Requirement: Real-asset previews
Builder pickers SHALL present each selectable option as a thumbnail rendered from the actual bundled asset (mesh, sprite, or clothing layer), not a generic placeholder icon.

#### Scenario: Picker shows real asset thumbnails
- **WHEN** the builder loads a part category
- **THEN** each option thumbnail is rendered from the actual corresponding asset

#### Scenario: Current selection is highlighted
- **WHEN** an option in the picker is currently selected in the composition
- **THEN** the picker marks that option as selected