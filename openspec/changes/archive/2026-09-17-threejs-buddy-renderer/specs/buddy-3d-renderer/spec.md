## Purpose

Renders each buddy as a live 3D avatar from its saved composition and mood, using locally-shipped 3D artwork with the original SVG parts applied as stickers on the model.

## ADDED Requirements

### Requirement: 3D avatar rendering
The system SHALL render each buddy avatar as a three-dimensional scene using WebGL in the browser, driven solely by the avatar's saved composition and current mood. Rendering SHALL be deterministic: the same composition and mood SHALL produce the same visual scene (fixed camera framing, lighting, and part placement) on every surface and on every render.

#### Scenario: Profile shows the buddy in 3D
- **WHEN** a visitor opens a profile page with a saved avatar
- **THEN** the avatar area displays a live WebGL-rendered 3D buddy instead of a flat image

#### Scenario: Same composition renders identically everywhere
- **WHEN** the same avatar composition and mood are shown in the builder preview, on the profile page, and in the embed widget
- **THEN** every surface renders the same 3D avatar, pose, lighting, and part placement

#### Scenario: Mood changes the rendered avatar
- **WHEN** a profile's current mood changes
- **THEN** the 3D avatar re-renders with that mood's expression and overlay accessory

### Requirement: SVG sticker parts
The system SHALL compose the customizable parts — hair style, eyes, mouth/expression, and accessory — from the application's original SVG artwork positioned on the 3D base model at fixed anchor points, and SHALL apply the composition's color palette (skin, shirt, background, accent) to the scene.

#### Scenario: Selected parts appear on the model
- **WHEN** an avatar has a hair style, eyes, mouth, and accessory selected
- **THEN** all four parts appear on the 3D model in their selected styles, positions, and colors

#### Scenario: Legacy head values still render
- **WHEN** a previously saved composition contains a head value from the old head-shape catalogue
- **THEN** the renderer treats that value as the equivalent hair style so existing avatars keep displaying

#### Scenario: Parts change without a reload
- **WHEN** a user changes a part or color on the builder
- **THEN** the 3D preview updates immediately without reloading the page

### Requirement: Local-only rendering assets
The system SHALL render the 3D avatar using only assets and code shipped with the application. The base 3D model and renderer modules MUST be served from the application's own static asset paths, and the renderer SHALL make no network request to any external service, CDN, or third-party asset source while rendering.

#### Scenario: Rendering makes no external requests
- **WHEN** a profile page or embed widget renders an avatar
- **THEN** all 3D model and SVG sticker assets resolve from the application's own static paths and no third-party or Buddy Poke asset request occurs

#### Scenario: 3D base model is served by the application
- **WHEN** a page that renders avatars loads
- **THEN** the 3D base model is fetchable from the application's own static asset URL

### Requirement: Renderer-driven avatar motion
The buddy's motion SHALL be produced by the renderer itself rather than by stylesheet animation, so the avatar's idle sway (profile and embed) and its sender/target reactions during interactions SHALL animate in 3D without reloading the page.

#### Scenario: Idle motion on profile and embed
- **WHEN** a profile page or embed widget displays a 3D avatar
- **THEN** the avatar plays a gentle idle animation driven by the renderer

#### Scenario: Target reacts during an interaction
- **WHEN** an interaction plays on a profile page
- **THEN** the target's 3D avatar reacts with the interaction's animation, and replaying the last interaction replays that reaction locally without a new request

### Requirement: Graceful degradation without WebGL
When WebGL is unavailable, the system SHALL show a clear, consistent fallback message in place of the 3D scene.

#### Scenario: No WebGL support
- **WHEN** a browser without WebGL support loads an avatar surface
- **THEN** the avatar area shows a readable fallback message and never a broken blank canvas

### Requirement: Single model load per page
The system SHALL fetch the 3D base model at most once per page load and SHALL reuse it for every avatar rendered on that page.

#### Scenario: Many avatars share one model
- **WHEN** a search results page or favorites page renders several avatars at once
- **THEN** only one request for the 3D base model occurs and every avatar still renders