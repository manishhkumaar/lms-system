# Topbar

The 64px bar above every admin page: page title, breadcrumb, global search, the page's primary action, notifications and the signed-in user with their role.

**Consumer provides:** `title`, optional `breadcrumb`, `userName`, `role`, `actions` (usually one primary `Button`), `search={false}` to hide search, `onMenu` (shows the menu button that opens the mobile drawer).

- Exactly one primary action per page, placed here.
- The role label under the user's name tells a person which dashboard they're in.
