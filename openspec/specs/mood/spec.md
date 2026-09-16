# Mood Specification

## Purpose

Lets profile owners set and persist a mood that visibly changes their avatar's appearance and is displayed on their public profile and embed widget.

## Requirements

### Requirement: Mood state
Mood SHALL be a persisted, named state (e.g. happy, sad, love, angry, excited, sleepy) attached to a profile. Each mood MUST map to a distinct visual treatment (expression and/or accessory) on the avatar.

#### Scenario: A profile always has a mood
- **WHEN** a user first saves an avatar and profile
- **THEN** the profile has a default mood set and the avatar renders with that mood's visual treatment

#### Scenario: Mood changes the avatar appearance
- **WHEN** a mood is set to a named state
- **THEN** the avatar renders with the expression and accessory defined for that mood

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

### Requirement: Mood visibility
The current mood SHALL be displayed textually and visually on the profile page and in the embed widget, and the mood name MUST be shown to all visitors.

#### Scenario: Profile shows mood to a visitor
- **WHEN** any visitor loads the profile
- **THEN** the profile displays the current mood name and the avatar shows its mood treatment