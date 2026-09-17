## Context

The current codebase has a fragmented avatar editing flow. The `/create` page (create.ejs, builder.js) only handles new buddy creation. The profile page (profile.ejs, profile.js) has an inline `buildAvatarEditor()` and "Change avatar" button in `buildOwnerActions()`. The avatar creation spec (`avatar-creation`) defines the core composition system but only exposes 4 part categories and 4 color keys. The buddylabs renderer (buddylabs.js) supports many more customization options that are not yet exposed in the UI.

See proposal.md - Why for the motivation.

## Goals / Non-Goals

**Goals:**
- Make `/create` page work for both creating and editing buddies when the user is logged in
- Remove the inline avatar editor from the profile page
- Expose all buddylabs customization options in the builder picker interface
- Keep the existing API contracts and data models intact

**Non-Goals:**
- Rewriting the buddylabs 3D renderer pipeline
- Adding authentication changes or new endpoints
- Changing the profile page layout for non-owners
- Adding new social features or interaction types

## Decisions

### Create page detects edit mode via route data
The `/create` route will pass `viewer` and `buddyData` (existing avatar composition) to the template. builder.js will detect if `buddyData` is present and pre-populate the builder state accordingly. The form submit will PUT to the existing profile instead of POST to create a new one.

### All buddylabs options exposed via expanded pickers
The `AVATAR_PARTS` and `PALETTES` in `avatar.js` will be expanded to include all body material categories, face atlas layers, and props from the buddylabs example. The `builder.js` `buildPickers()` and `buildColors()` functions will render all new categories. The `defaultComposition()` will include all new defaults.

### Profile page replaces avatar editor with a link
In `profile.js`, `buildOwnerActions()` will replace the "Change avatar" button with a link to `/create`. The `buildAvatarEditor()`, `toggleEditor()`, `buildProfilePickers()`, `buildProfileColors()`, `composeEditorState()`, and `saveAvatar()` functions are removed entirely.

### API remains unchanged
The existing PUT `/api/profile/:username` endpoint already supports updating `avatarDef`. No new API routes are needed. The create page's form handler in builder.js will switch between POST (new buddy) and PUT (edit) based on whether `buddyData` is present.

## Risks / Trade-offs

- **Expanded UI complexity**: Adding all buddylabs options significantly increases the picker UI size. Mitigation: Use collapsible sections or categorized tabs to keep the interface manageable
- **Backward compatibility**: Existing stored `avatarDef` objects only have 4 part categories and 4 color keys. New options should default gracefully. Mitigation: `resolvePart()` already handles legacy values by resetting to defaults; new fields should follow the same pattern
- **Builder page size**: The create page becomes more feature-rich. Mitigation: The existing grid/flex layouts in builder.js should accommodate additional pickers

## Migration Plan

1. Update `avatar.js` to expand `AVATAR_PARTS`, `PALETTES`, and `defaultComposition()` with all buddylabs options
2. Update `builder.js` to support edit mode detection, expanded pickers, and PUT-based saving for edits
3. Update `create.ejs` to pass `buddyData` when a logged-in user visits
4. Update `pages.js` `/create` route to pass existing buddy data
5. Update `profile.js` to remove avatar editor and replace "Change avatar" with a `/create` link
6. Update `profile.ejs` if needed to remove references to avatar editor elements
7. Update `mood` spec and `user-profile` spec to reflect the removal of inline avatar editing

## Open Questions

- Should the create page show a "Edit buddy" vs "Create buddy" heading depending on mode?
- How should the expanded buddylabs options be organized in the UI (tabs, collapsible sections, or a single scrollable list)?
- What are the exact additional part categories and options from the buddylabs example that should be exposed?