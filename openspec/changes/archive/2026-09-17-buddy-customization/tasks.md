## 1. Expand Avatar Data Model

- [x] 1.1 Update `src/public/avatar.js` to expand `AVATAR_PARTS` with all body material categories (skin, shirt, pants, belt, etc.), face atlas layers (spot, mouth, eye shadow, mask, eyes, brows, beard, glasses, mustache), and props from the buddylabs example. Verify all option values are valid catalog names
- [x] 1.2 Update `PALETTES` in `avatar.js` to include additional color palettes needed for body materials (shrtSpectrum, pantSpectrum, eye, etc.) matching buddylabs palette definitions
- [x] 1.3 Update `defaultComposition()` in `avatar.js` to include defaults for all new part categories with appropriate default values
- [x] 1.4 Verify `resolvePart()` handles legacy stored avatarDefs gracefully by resetting unknown values to defaults

## 2. Update Builder for Edit Mode and All Options

- [x] 2.1 Update `src/routes/pages.js` `/create` route to pass `buddyData` (existing avatar composition) when the logged-in user visits `/create`
- [x] 2.2 Update `src/services/page-service.js` to provide a method for retrieving existing buddy data for the create page
- [x] 2.3 Update `src/views/create.ejs` to pass `buddyData` to the page when available, and show appropriate heading ("Create your buddy" vs "Edit your buddy")
- [x] 2.4 Update `src/public/builder.js` to detect `buddyData` parameter and pre-populate `state.composition` with existing avatar data
- [x] 2.5 Update `src/public/builder.js` form handler to use PUT `/api/profile/:username` when editing (when `buddyData` exists) instead of POST `/api/profiles`
- [x] 2.6 Update `src/public/builder.js` `buildPickers()` and `buildColors()` to render all expanded avatar part categories and color palettes
- [x] 2.7 Update `src/public/builder.js` to handle the expanded UI with all buddylabs customization options (body materials, face layers, hair/hat combos, props)

## 3. Remove Inline Avatar Editor from Profile Page

- [x] 3.1 Update `src/public/profile.js` to remove `buildAvatarEditor()`, `toggleEditor()`, `buildProfilePickers()`, `buildProfileColors()`, `composeEditorState()`, and `saveAvatar()` functions
- [x] 3.2 Update `src/public/profile.js` `buildOwnerActions()` to replace the "Change avatar" button with a link to `/create`
- [x] 3.3 Update `src/views/profile.ejs` to remove any references to the inline avatar editor elements (`#profile-editors` content related to avatar editing)
- [x] 3.4 Remove `activeEditor` state variable and `els.editors` references from `profile.js` if no longer used by mood editor

## 4. Update Spec Documents

- [x] 4.1 Update `openspec/specs/avatar-creation/spec.md` to reflect the expanded customization options and the edit capability
- [x] 4.2 Update `openspec/specs/user-profile/spec.md` to reflect the removal of inline avatar editing controls and the new `/create` link for avatar editing
- [x] 4.3 Update `openspec/specs/mood/spec.md` if mood editing is affected by the changes

## 5. Verification

- [x] 5.1 Verify that a logged-in user visiting `/create` sees their existing buddy pre-loaded in the builder
- [x] 5.2 Verify that saving an edited buddy updates the profile correctly
- [x] 5.3 Verify that the profile page no longer has a "Change avatar" button and shows a link to `/create` instead
- [x] 5.4 Verify that all new customization options render correctly in the builder pickers
- [x] 5.5 Verify that creating a new buddy (non-logged-in) still works as before
- [x] 5.6 Run existing tests to confirm no regressions