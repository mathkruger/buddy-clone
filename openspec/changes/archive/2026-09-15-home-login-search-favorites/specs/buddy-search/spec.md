## Purpose

Lets visitors find buddies by username and open their profiles, mirroring how people searched for friends on the original Buddy Poke.

## ADDED Requirements

### Requirement: Username search endpoint
The system SHALL provide an endpoint that accepts a username query and returns the public profiles of buddies whose usernames match the query.

#### Scenario: Query matches existing buddies
- **WHEN** a visitor submits a query that matches one or more existing usernames
- **THEN** the system returns those profiles including each buddy's avatar and mood

#### Scenario: Query matches no buddies
- **WHEN** a visitor submits a query that matches no usernames
- **THEN** the system returns an empty result list

#### Scenario: Blank query
- **WHEN** a visitor submits an empty or whitespace-only query
- **THEN** the system returns an empty result list without searching

### Requirement: Search page
The system SHALL provide a search page where a visitor can enter a query and see the matching buddies with their avatars, each linking to that buddy's profile.

#### Scenario: Searching from the page
- **WHEN** a visitor types a query into the search page and submits it
- **THEN** the page lists the matching buddies with their avatars and links to their profiles

#### Scenario: Opening a result
- **WHEN** a visitor clicks a search result
- **THEN** they are taken to that buddy's public profile page

#### Scenario: No results feedback
- **WHEN** a search returns no matches
- **THEN** the page shows an empty-state message so the visitor knows nothing matched