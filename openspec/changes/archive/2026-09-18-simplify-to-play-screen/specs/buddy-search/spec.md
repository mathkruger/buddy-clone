## REMOVED Requirements

### Requirement: Username search endpoint
**Reason**: Buddy search is removed from the product. The app now has a single play screen and friends are added by exact username in the Friends tab; there is no search surface anywhere.
**Migration**: Use the Friends tab's add-by-username control, which validates that the username exists.

### Requirement: Search page
**Reason**: The search page is removed along with the search endpoint. Any search UI, route, view, service, and tests are deleted.
**Migration**: None. Search is not replaced.