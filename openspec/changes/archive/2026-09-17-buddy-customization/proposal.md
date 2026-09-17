## Why

The current buddy creation flow is fragmented: `/create` only works for new buddies, while the profile page has a separate inline "Change avatar" editor. This redundancy confuses users and doesn't match the buddylabs customization model where all options are available in a single reusable page. We need a unified flow that lets logged-in users edit their buddy from the creation page and removes the duplicate editor from the profile page.

## What Changes

- **Make the `/create` page reusable for editing**: When a logged-in user visits `/create`, they should be able to edit their existing buddy's avatar using the same builder interface, instead of being forced to log out and create a new buddy
- **Remove the inline "Change avatar" editor from the profile page**: The `buildAvatarEditor()` and "Change avatar" button in `buildOwnerActions()` on the profile page will be removed; avatar editing is handled by the reusable create page
- **Expand customization options following the buddylabs example**: All avatar customization options available in the buddylabs renderer (body materials, face atlas layers, hair/hat combos, props, palette selections) should be exposed in the picker interface, not just the current subset
- **BREAKING**: The profile page no longer provides inline avatar editing; owners must use `/create` to edit their buddy's avatar

## Capabilities

### New Capabilities
- `buddy-edit`: Lets logged-in users edit their existing buddy from the `/create` page, with all customization options available in a unified builder interface

### Modified Capabilities
- `avatar-creation`: The avatar composition system now supports editing existing profiles and exposes all buddylabs customization options (body materials, face atlas layers, hair/hat combos, props, palette selections) in the picker interface
- `user-profile`: The profile page no longer displays inline avatar editing controls; the "Change avatar" button and `buildAvatarEditor()` are removed, leaving only "Change mood" and "My favorites" as owner actions

## Impact

- `src/views/create.ejs` — must handle both create and edit modes based on login state
- `src/public/builder.js` — must detect whether the user is editing an existing buddy and pre-populate the builder; must expose all buddylabs customization options
- `src/public/profile.js` — `buildOwnerActions()` loses the "Change avatar" button; `buildAvatarEditor()` and related functions are removed
- `src/routes/pages.js` — `/create` route must pass existing buddy data when a logged-in user visits
- `src/services/page-service.js` — must provide buddy data for edit mode
- `src/routes/profiles.js` — no API changes needed; the PUT endpoint already supports avatar updates
- `src/public/avatar.js` — may need to expand `AVATAR_PARTS` and `PALETTES` to cover all buddylabs options