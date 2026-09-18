## MODIFIED Requirements

### Requirement: Embed widget rendering
An embed widget SHALL render the target user's avatar with current mood inside an external page without requiring a visitor account, and SHALL include a link back to the app. Since public profile pages are removed, the link SHALL point to the play screen URL (from which a logged-in owner reaches their buddy).

#### Scenario: Widget renders on an external page
- **WHEN** an external page includes the embed snippet and a visitor loads it
- **THEN** the widget renders the user's avatar with the current mood and a link to the app's play screen

#### Scenario: Widget shows current mood
- **WHEN** the embed widget renders
- **THEN** it shows the same mood as the play screen stage at that moment