## Purpose

The server renders every site HTML document from reusable EJS templates with a shared layout and partials, so the browser always receives complete pages and site chrome is maintained in one place instead of duplicated per page.

## ADDED Requirements

### Requirement: Pages rendered from templates with shared site chrome
The system SHALL render every site page through a server-side template system on the server using a shared layout for site chrome, so the page body is defined once per page and the chrome (site header, navigation with the auth slot, footer, session script) is not duplicated per page.

#### Scenario: All site pages include the shared chrome
- **WHEN** a visitor loads the home page, the buddy creation page, the login page, the search page, the favorites page, or the profile page
- **THEN** the rendered page includes the shared site header and navigation containing the `nav-auth` slot and loads the session script

#### Scenario: Page bodies use the layout
- **WHEN** the server renders any site page
- **THEN** the page is a complete HTML document assembled from the shared layout plus that page's own body content

### Requirement: Site routes serve server-rendered pages
The system SHALL serve the home, create, login, search, and favorites pages at their existing URLs with HTML rendered by the server from templates on each request.

#### Scenario: Each site page route returns a rendered page
- **WHEN** a visitor requests `/`, `/create`, `/login`, `/search`, or `/favorites`
- **THEN** the server responds with 200 and the rendered HTML page for that route

### Requirement: Dynamic profile data embedded at render time
The system SHALL embed an existing profile's data into the profile and embed pages at render time as an inert inline JSON payload in the `buddy-profile` script element, so the client-side profile scripts can read the profile without changing.

#### Scenario: Profile page embeds the profile payload
- **WHEN** a visitor loads the profile page of an existing username
- **THEN** the rendered page contains the `buddy-profile` inline JSON payload with the profile's data and no raw angle brackets inside the payload

#### Scenario: Embed page embeds the profile payload
- **WHEN** a visitor loads the embed page of an existing username
- **THEN** the rendered embed page contains the inert `buddy-profile` inline JSON payload and stays frameable by external host pages

### Requirement: Not-found page escapes the requested username
The system SHALL render a not-found page when a requested username has no profile, showing the requested username escaped so it cannot inject markup, and keep serving the same not-found status.

#### Scenario: Unknown profile shows a safe not-found page
- **WHEN** a visitor loads the profile URL of a username that has no profile
- **THEN** the server responds with a 404 HTML page that shows the escaped username and contains no raw injected markup

### Requirement: Client assets remain static and unchanged
The system SHALL continue to serve the client-side JavaScript and CSS as static assets at their existing URLs, unchanged in behavior, so the rendering refactor does not alter client-side code.

#### Scenario: Static assets are served as-is
- **WHEN** a client requests `style.css`, `session.js`, `avatar.js`, `builder.js`, `profile.js`, `interactions.js`, `widget.js`, `moods.js`, `login.js`, `search.js`, or `favorites.js`
- **THEN** the server responds with the unchanged static asset at that URL