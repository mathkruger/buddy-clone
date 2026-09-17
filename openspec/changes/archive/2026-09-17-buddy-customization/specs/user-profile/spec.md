## REMOVED Requirements

### Requirement: Profile shows avatar editing controls
**Reason**: Removed as part of consolidating avatar editing into the `/create` page. The "Change avatar" button and inline editor in `buildOwnerActions()` no longer exist.
**Migration**: Owners click the "Edit buddy" link on their profile page to navigate to `/create`

## MODIFIED Requirements

### Requirement: Edit controls only for the owner
The profile SHALL display edit controls only when the visitor's browser holds the profile's claim token. Edit controls SHALL now consist of "Change mood" and a link to `/create` to edit the avatar. The inline avatar editor is removed entirely.

#### Scenario: Owner sees edit controls
- **WHEN** the browser holding the profile's claim token loads the profile
- **THEN** the page shows controls to change the mood and a link to `/create` to edit the avatar

#### Scenario: Visitor sees a read-only profile
- **WHEN** a browser without the claim token loads the profile
- **THEN** the page shows no edit controls and the visitor can only view and interact