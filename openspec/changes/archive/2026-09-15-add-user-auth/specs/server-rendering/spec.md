## MODIFIED Requirements

### Requirement: Pages rendered from templates with shared site chrome
The system SHALL render every site page through a server-side template system on the server using a shared layout for site chrome, so the page body is defined once per page and the chrome (site header, navigation with the auth slot, footer, session script) is not duplicated per page. The auth slot SHALL reflect the user's real authenticated session as reported by the auth API.

#### Scenario: All site pages include the shared chrome
- **WHEN** a visitor loads the home page, the buddy creation page, the login page, the search page, the favorites page, or the profile page
- **THEN** the rendered page includes the shared site header and navigation containing the `nav-auth` slot and loads the session script

#### Scenario: Page bodies use the layout
- **WHEN** the server renders any site page
- **THEN** the page is a complete HTML document assembled from the shared layout plus that page's own body content

#### Scenario: Auth slot reflects the authenticated session
- **WHEN** an authenticated user loads a page
- **THEN** the auth slot shows that user's identity and logged-in actions, and shows a login link to anonymous visitors

### Requirement: Site routes serve server-rendered pages
The system SHALL serve the home, create, and login pages at their existing URLs with HTML rendered by the server from templates on each request. The search and favorites pages SHALL be served only to logged-in users, and a profile page SHALL be served only to logged-in users; anonymous visitors SHALL be redirected to the login page.

#### Scenario: Each site page route returns a rendered page
- **WHEN** a visitor requests `/`, `/create`, or `/login`
- **THEN** the server responds with 200 and the rendered HTML page for that route

#### Scenario: Gated site page routes redirect anonymous visitors
- **WHEN** an anonymous visitor requests `/search`, `/favorites`, or a profile URL
- **THEN** the server redirects them to the login page instead of rendering the page

### Requirement: Dynamic profile data embedded at render time
The system SHALL embed an existing profile's data into the profile page at render time for logged-in viewers and into the public embed page, as an inert inline JSON payload in the `buddy-profile` script element, so the client-side profile scripts can read the profile without changing.

#### Scenario: Profile page embeds the profile payload
- **WHEN** a logged-in user loads the profile page of an existing username
- **THEN** the rendered page contains the `buddy-profile` inline JSON payload with the profile's data and no raw angle brackets inside the payload

#### Scenario: Embed page embeds the profile payload
- **WHEN** a visitor loads the embed page of an existing username
- **THEN** the rendered embed page contains the inert `buddy-profile` inline JSON payload and stays frameable by external host pages

### Requirement: Client assets remain static and unchanged
The system SHALL continue to serve the client-side JavaScript and CSS as static assets at their existing URLs, so the server does not inline or rewrite client behavior into the HTML.

#### Scenario: Static assets are served as-is
- **WHEN** a client requests `style.css`, `session.js`, `avatar.js`, `builder.js`, `profile.js`, `interactions.js`, `widget.js`, `moods.js`, `login.js`, `search.js`, or `favorites.js`
- **THEN** the server responds with the static asset at that URL