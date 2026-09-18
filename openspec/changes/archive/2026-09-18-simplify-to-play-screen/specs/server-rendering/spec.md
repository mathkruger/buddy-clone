## REMOVED Requirements

### Requirement: Dynamic profile data embedded at render time
**Reason**: Public profile pages are removed. The profile payload for the current user is now embedded into the play page instead.
**Migration**: The ADDED "Play page embeds the profile data at render time" requirement below replaces this one; the embed page keeps its own inert payload.

### Requirement: Not-found page escapes the requested username
**Reason**: There are no per-username profile routes anymore, so a not-found page is now reached through unknown paths rather than unknown usernames.
**Migration**: The ADDED "Not-found page escapes the requested path" requirement below replaces this one.

## ADDED Requirements

### Requirement: Play page embeds the profile data at render time
The system SHALL embed the current user's profile data into the play page at render time as an inert inline JSON payload in the `buddy-profile` script element, so the client-side play scripts can read the profile without a separate fetch.

#### Scenario: Play page embeds the profile payload
- **WHEN** the server renders the play page for a logged-in user
- **THEN** the rendered page contains the `buddy-profile` inline JSON payload with the profile's data and no raw angle brackets inside the payload

### Requirement: Not-found page escapes the requested path
The system SHALL render a not-found page for a requested URL that has no route, showing the requested path escaped so it cannot inject markup, and keep serving the same not-found status.

#### Scenario: Unknown route shows a safe not-found page
- **WHEN** a visitor loads a URL that has no route
- **THEN** the server responds with a 404 HTML page that shows the escaped requested path and contains no raw injected markup

## MODIFIED Requirements

### Requirement: Pages rendered from templates with shared site chrome
The system SHALL render every site page through a server-side template system on the server using a shared layout for site chrome, so the page body is defined once per page and the chrome (site header, navigation with the auth slot, footer, session script) is not duplicated per page.

#### Scenario: All site pages include the shared chrome
- **WHEN** a visitor loads the landing page, the register page, the login page, or the play page
- **THEN** the rendered page includes the shared site header and navigation containing the `nav-auth` slot and loads the session script

#### Scenario: Page bodies use the layout
- **WHEN** the server renders any site page
- **THEN** the page is a complete HTML document assembled from the shared layout plus that page's own body content

### Requirement: Site routes serve server-rendered pages
The system SHALL serve the landing, register, login, and play pages at their URLs with HTML rendered by the server from templates on each request.

#### Scenario: Each site page route returns a rendered page
- **WHEN** a visitor requests `/`, `/register`, `/login`, or `/play`
- **THEN** the server responds with 200 and the rendered HTML page for that route

### Requirement: Client assets remain static and unchanged
The system SHALL continue to serve the client-side JavaScript and CSS as static assets at their existing URLs, unchanged in behavior where the scripts remain in use.

#### Scenario: Static assets are served as-is
- **WHEN** a client requests `style.css`, `session.js`, `avatar.js`, `buddylabs.js`, `buddy-3d.js`, `buddy-thumbs.js`, `interactions.js`, `moods.js`, `widget.js`, `login.js`, `play.js`, or `register.js`
- **THEN** the server responds with the unchanged static asset at that URL