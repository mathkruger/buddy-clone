## MODIFIED Requirements

### Requirement: Database-backed repository
The system SHALL persist all application data in a database managed by the repository layer instead of rewriting a single JSON file on every write. All existing data (profiles with avatar definitions and moods, bcrypt password hashes for accounts, interaction history, and favorites) SHALL be stored in the database and SHALL survive process restarts.

#### Scenario: Data survives restart
- **WHEN** a profile with a password, interactions, and favorites is created and the server is restarted against the same database
- **THEN** the profile, its password hash, its interactions, and its favorites are available unchanged

#### Scenario: Data kinds persist
- **WHEN** a profile is created, updated, sent interactions, and manages favorites
- **THEN** every change is reflected in the database and is returned by subsequent reads

#### Scenario: Passwords are stored only as hashes
- **WHEN** a profile is created with a password
- **THEN** the database stores a salted password hash and never the plaintext password, and no API returns the hash

### Requirement: Migration from legacy JSON file
When the system initializes and finds a database with no data plus a legacy JSON data file at the configured data location, the system SHALL import every stored profile (avatar definition, mood, token hash, creation timestamp, interaction history, and favorites) into the database. When a legacy profile has no usable password hash, its account SHALL be imported without a password and SHALL NOT be able to log in. The legacy JSON file SHALL be left in place, not deleted. When the database already contains data, the system SHALL NOT import the JSON file.

#### Scenario: First run migrates existing data
- **WHEN** the server starts against an empty database while a legacy `data.json` file exists
- **THEN** all profiles from the JSON file are available through the repository in the database and the JSON file still exists on disk

#### Scenario: Legacy profiles without a password are inert
- **WHEN** a legacy profile is imported that has no password hash
- **THEN** the profile remains viewable and embeddable but cannot be logged into

#### Scenario: Existing database is not re-imported
- **WHEN** the server starts against a database that already contains profiles while a legacy `data.json` file exists
- **THEN** the database contents are used and the JSON file is ignored

#### Scenario: No legacy file means an empty database
- **WHEN** the server starts with no legacy JSON file and an empty database location
- **THEN** the database is initialized empty and profiles can be created normally