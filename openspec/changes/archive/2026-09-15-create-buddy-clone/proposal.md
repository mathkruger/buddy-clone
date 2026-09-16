## Why

Buddy Poke was a beloved social avatar widget from the Orkut era that let users express themselves visually through customizable avatars, moods, and animated interactions with friends. We want to recreate that same nostalgic, playful social experience as a modern clone — with no original assets reused — using a simple plain HTML/CSS/JS stack with a lightweight server for storage. No accounts are required: users claim a username and get a public profile page; anyone can send them animated interactions.

## What Changes

- **Avatar creation and customization**: A builder interface where users compose avatars from visual components (head shape, eyes, expressions, accessories, colors), giving each avatar its own personality — the same spirit as Buddy Poke but with original art and styling.
- **Public user profiles**: Username-based profile pages (`/:username`) that display the user's avatar and current mood — no registration or login required.
- **Mood system**: Users set and change their mood at any time; mood is persisted and displayed visually on their profile and embed widget.
- **Embeddable widget**: An HTML snippet users can copy-paste into blogs, MySpace pages, or forums to display their avatar and current mood externally — the original's killer viral feature.
- **User-to-user interactions**: Users can visit another user's profile and trigger an animated effect (the "interaction") that plays on that profile's avatar, recreating the original "poke" mechanic.
- **Lightweight backend**: A small Node.js (or Python) server to handle username claiming, profile data storage, mood persistence, and interaction delivery — keeping things simple with flat-file or SQLite storage.

## Capabilities

### New Capabilities

- `avatar-creation`: Avatar builder interface — composing avatars from visual components, selecting colors and accessories, previewing and saving.
- `user-profile`: Public username-based profile page displaying the user's avatar, current mood, and interaction history.
- `mood`: Setting, changing, and persisting mood state on an avatar, displayed on profiles and embed widget.
- `embed-widget`: Generating embeddable HTML snippets that display a user's avatar and mood externally (iframe or script-based).
- `interactions`: Sending and receiving animated interactions between users — triggering animations on another user's profile avatar.

### Modified Capabilities

None — this is a greenfield project with no existing specs.

## Impact

- **New static frontend**: All HTML/CSS/JS files — no framework, no build step. Pages: home (avatar builder, link to profile), profile (`/:username`), embed generation page.
- **New backend server**: Small server for serving profiles, saving avatar/mood data, handling interactions. Flat-file or SQLite storage sufficient for initial scope.
- **No existing code affected**: Greenfield project — no prior implementation or dependencies to modify.
- **Third-party assets**: All avatar art and animations must be original; no Buddy Poke assets may be reused.
