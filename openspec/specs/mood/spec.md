# Mood Specification

## Purpose

Lets profile owners set and persist a mood that visibly changes their avatar's appearance and is displayed on their public profile and embed widget.

## Requirements

### Requirement: Changing mood
The owner of a profile SHALL be able to change the current mood at any time using their browser claim token. The system MUST persist the change, and the profile and embed widget MUST show the new mood on subsequent loads.

#### Scenario: Owner changes mood successfully
- **WHEN** the profile owner selects a new mood from the available moods
- **THEN** the system persists the new mood and the avatar re-renders showing it

#### Scenario: Rejecting an invalid mood
- **WHEN** a change request specifies a mood that is not in the supported mood set
- **THEN** the system rejects the request and leaves the current mood unchanged

#### Scenario: Non-owner cannot change mood
- **WHEN** a request to change mood is made without the profile's claim token
- **THEN** the system rejects the request and the mood remains unchanged

### Requirement: Humor state
Humor SHALL be a persisted, named state (e.g. happy, sad, love, angry, excited, sleepy) attached to a profile, also called the current mood. Each humor MUST map to a distinct visual treatment (expression and/or accessory) and a looped animation on the avatar. When no humor is set, the avatar SHALL cycle randomly through the humor animations while idling.

#### Scenario: A profile always has a mood
- **WHEN** a user first creates an account
- **THEN** the profile has a default mood set and the avatar renders with that mood's visual treatment

#### Scenario: Humor changes the avatar appearance
- **WHEN** a humor is set to a named state
- **THEN** the avatar renders with the expression, accessory, and looped animation defined for that humor

#### Scenario: No humor set cycles randomly
- **WHEN** the owner has selected "None" in the Humor tab
- **THEN** the avatar cycles randomly through the humor animations while idle

### Requirement: Changing humor
The owner of a profile SHALL be able to play, and optionally persist, a humor from the play screen's Humor tab using their authenticated session. Selecting a humor SHALL play its animation on the main stage; a separate action SHALL persist it as the current mood. The system MUST persist the change, and the play screen MUST show the new mood on subsequent loads.

#### Scenario: Owner changes mood successfully
- **WHEN** the owner clicks a humor in the Humor tab and confirms it as the current mood
- **THEN** the system persists the new mood and the stage re-renders showing it as the looping animation

#### Scenario: Rejecting an invalid mood
- **WHEN** a change request specifies a humor that is not in the supported humor set
- **THEN** the system rejects the request and leaves the current mood unchanged

#### Scenario: Non-owner cannot change mood
- **WHEN** a request to change humor is made without an authenticated session for that profile
- **THEN** the system rejects the request and the mood remains unchanged

### Requirement: Humor visibility
The current mood SHALL be displayed visually on the play screen's main stage and in the embed widget, and the mood name SHALL be identifiable by the owner in the Humor tab.

#### Scenario: Play screen shows the humor to the owner
- **WHEN** an owner with a mood set loads the play screen
- **THEN** the main stage displays the avatar with its humor treatment and the Humor tab highlights the active mood