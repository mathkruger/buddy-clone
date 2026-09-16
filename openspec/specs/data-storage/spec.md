# Data Storage Specification

## Purpose

Defines how the application stores and retrieves its persistent data (profiles, token hashes, interaction history, favorites) in a database-backed repository behind a pluggable storage provider, including migration from the legacy single JSON file and isolated databases for tests so the development data is never disturbed.

## Requirements

### Requirement: Database-backed repository
The system SHALL persist all application data in a database managed by the repository layer instead of rewriting a single JSON file on every write. All existing data (profiles with avatar definitions and moods, authentication token hashes, interaction history, and favorites) SHALL be stored in the database and SHALL survive process restarts.

#### Scenario: Data survives restart
- **WHEN** a profile with interactions and favorites is created and the server is restarted against the same database
- **THEN** the profile, its interactions, and its favorites are available unchanged

#### Scenario: Data kinds persist
- **WHEN** a profile is created, updated, sent interactions, and manages favorites
- **THEN** every change is reflected in the database and is returned by subsequent reads

### Requirement: Pluggable storage provider
The system SHALL support more than one database provider behind a single repository interface, selected through configuration. A file-based SQLite database SHALL be the default provider. Adding or changing the provider SHALL NOT change the repository API used by the rest of the application.

#### Scenario: Default provider is SQLite
- **WHEN** the server starts without an explicit storage-provider override
- **THEN** data is stored in a SQLite database file

#### Scenario: Provider swappable via configuration
- **WHEN** the server is configured with an alternative supported provider
- **THEN** the application reads and writes the same data through the same repository API

### Requirement: Migration from legacy JSON file
When the system initializes and finds a database with no data plus a legacy JSON data file at the configured data location, the system SHALL import every stored profile (avatar definition, mood, token hash, creation timestamp, interaction history, and favorites) into the database. The legacy JSON file SHALL be left in place, not deleted. When the database already contains data, the system SHALL NOT import the JSON file.

#### Scenario: First run migrates existing data
- **WHEN** the server starts against an empty database while a legacy `data.json` file exists
- **THEN** all profiles from the JSON file are available through the repository in the database and the JSON file still exists on disk

#### Scenario: Existing database is not re-imported
- **WHEN** the server starts against a database that already contains profiles while a legacy `data.json` file exists
- **THEN** the database contents are used and the JSON file is ignored

#### Scenario: No legacy file means an empty database
- **WHEN** the server starts with no legacy JSON file and an empty database location
- **THEN** the database is initialized empty and profiles can be created normally

### Requirement: Isolated test databases
Automated and smoke tests SHALL run against a dedicated database, separate from the development database, so test runs never modify development data.

#### Scenario: Smoke tests use their own database
- **WHEN** the smoke test suite boots the server with its configured database location
- **THEN** the server reads from and writes to the dedicated test database file and the development database is left unmodified