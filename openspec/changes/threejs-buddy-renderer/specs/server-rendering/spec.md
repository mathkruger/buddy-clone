## MODIFIED Requirements

### Requirement: Client assets remain static and unchanged
The system SHALL serve the client-side JavaScript, CSS, 3D model, and avatar assets as static files from the application's own public asset directory at their stable URLs, without on-the-fly transformation, and SHALL update the content of those files only as part of a deliberate application change. The avatar-related static set includes the shared avatar data module, the 3D renderer modules, the vendored WebGL library, and the 3D base model.

#### Scenario: Static assets are served as-is
- **WHEN** a client requests `style.css`, `session.js`, `avatar.js`, `builder.js`, `profile.js`, `interactions.js`, `widget.js`, `moods.js`, `login.js`, `search.js`, `favorites.js`, or the 3D renderer and vendored WebGL modules
- **THEN** the server responds with the static asset file stored in the public asset directory at that URL

#### Scenario: 3D model and vendored library are served
- **WHEN** a client requests the 3D base model file or a vendored WebGL library module
- **THEN** the server responds with the file from the application's own static assets