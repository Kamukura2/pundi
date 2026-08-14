# Patch v8.1.1 — Simple Mobile Drawer Navigation

This patch simplifies phone and tablet navigation without changing the desktop workspace or finance calculations.

## Changes

- Removes the crowded nine-button mobile bottom navigation.
- Adds a hamburger control in the upper-left mobile header.
- Reuses the complete desktop sidebar as a slide-in mobile drawer, including Available Balance and projections.
- Closes the drawer after a destination is selected, on backdrop press, or with Escape.
- Keeps one floating `+` transaction action in the lower-right corner.
- Adds safe-area spacing and keeps native vertical page scrolling available while the drawer is closed.

## Deployment

Upload the changed application files and redeploy. No Supabase migration is required.
