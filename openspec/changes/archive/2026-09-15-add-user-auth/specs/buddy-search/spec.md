## MODIFIED Requirements

### Requirement: Username search endpoint
The system SHALL provide an endpoint that accepts a username query and returns the profiles of buddies whose usernames match the query. The endpoint SHALL be available only to logged-in accounts; an anonymous request SHALL be rejected.

#### Scenario: Query matches existing buddies
- **WHEN** a logged-in user submits a query that matches one or more existing usernames
- **THEN** the system returns those profiles including each buddy's avatar and mood

#### Scenario: Query matches no buddies
- **WHEN** a logged-in user submits a query that matches no usernames
- **THEN** the system returns an empty result list

#### Scenario: Blank query
- **WHEN** a logged-in user submits an empty or whitespace-only query
- **THEN** the system returns an empty result list without searching

#### Scenario: Anonymous search is rejected
- **WHEN** a request to search is made without a valid session
- **THEN** the system rejects the request and returns no results

### Requirement: Search page
The system SHALL provide a search page where a logged-in user can enter a query and see the matching buddies with their avatars, each linking to that buddy's profile. An anonymous visitor SHALL be redirected to the login page instead of the search page.

#### Scenario: Searching from the page
- **WHEN** a logged-in user types a query into the search page and submits it
- **THEN** the page lists the matching buddies with their avatars and links to their profiles

#### Scenario: Opening a result
- **WHEN** a logged-in user clicks a search result
- **THEN** they are taken to that buddy's profile page

#### Scenario: No results feedback
- **WHEN** a search returns no matches
- **THEN** the page shows an empty-state message so the user knows nothing matched

#### Scenario: Anonymous visitor is redirected
- **WHEN** a visitor who is not logged in opens the search page
- **THEN** the system redirects them to the login page