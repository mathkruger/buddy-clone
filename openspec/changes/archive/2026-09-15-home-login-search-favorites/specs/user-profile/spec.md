## ADDED Requirements

### Requirement: Received pokes show their sender
The profile SHALL display the pokes received together with which buddy sent each one. Each sender who is a claimed user SHALL link to that sender's own public profile; the default guest sender SHALL be shown as a guest.

#### Scenario: Profile shows who poked
- **WHEN** any visitor loads a profile that has received interactions
- **THEN** the page shows the recent pokes with the sending buddy's username or as a guest sender when the interaction was sent without a claimed identity

#### Scenario: Sender profiles are linked
- **WHEN** a visitor clicks a claimed sender's username in the poke history
- **THEN** they are taken to that sender's public profile page