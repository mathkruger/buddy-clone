## REMOVED Requirements

### Requirement: Public profile page
**Reason**: Public per-user profile pages are removed as part of the move to a single play screen. A buddy's avatar and mood now render on the play screen of their owner, and there is no public per-username page any visitor can open.
**Migration**: The play screen (`/play`) renders the owner's buddy and mood. Anyone who wants another person's buddy visible should poke them from the Friends tab; pokes appear in the recipient's BuddyClone feed.

### Requirement: Edit controls only for the owner
**Reason**: Ownership-gated editing moves entirely into the play screen. The owner customizes appearance, humor, friends, and pokes from the play screen; there is no separate profile page on which edit controls would appear.
**Migration**: Use the play screen's Appearance, Humor, and Friends tabs.

### Requirement: Interaction entry point
**Reason**: The public "send an interaction on a profile" entry point is gone with the profile pages. Poking now happens from the play screen's Friends tab, and received pokes are consumed in the BuddyClone tab.
**Migration**: Sending a poke to a friend is done from the Friends tab; replaying or poking back is done in the BuddyClone tab.

### Requirement: Received pokes show their sender
**Reason**: Poke history is no longer displayed on a public profile. Received pokes are shown privately to the owner in the play screen's BuddyClone tab with sender, type, and time, and the owner can poke back from there.
**Migration**: The BuddyClone tab replaces this surface.

## ADDED Requirements

### Requirement: Buddy appears on the play screen
The buddy's avatar and current mood SHALL be rendered on the play screen's main stage for its owner, reflecting the persisted appearance composition and mood.

#### Scenario: Play screen renders the buddy
- **WHEN** the owner opens the play screen
- **THEN** the main stage shows the owner's buddy with the saved appearance and, when a mood is set, that mood's visual treatment

#### Scenario: Mood change is reflected on the stage
- **WHEN** the owner changes the mood via the Humor tab
- **THEN** the main stage renders the buddy with the newly applied mood treatment