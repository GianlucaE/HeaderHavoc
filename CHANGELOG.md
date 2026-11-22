# Changelog

## 1.1.0 — 2026-11-22

### Fixed

- Rapid edits could leave a stale rule registered with Chrome. Recompiles overlapped, and one could delete only the
  rules it had seen while another added more. Recompiles now run one at a time and always use the latest settings.
- **Refresh** in Diagnostics reported "Rules recompiled" even when recompiling failed.
- A profile that was switched on but not filled in yet looked live: it had the blue rail, counted as active and
  raised the toolbar badge, while rewriting nothing.
- Duplicating a switched-on profile produced an immediate conflict with the original.
- New profile names could repeat after a delete.

### Changed

- Deleting a profile, a URL pattern or a header, and importing a file, now show an **Undo** toast instead of a
  confirmation dialog. Removing a single row previously had no way back at all.
- Collapsed profiles show the header they set and their first URL pattern — `iv-user: jdoe · api.example.com` —
  instead of a count. Values of secret-looking headers (key, token, auth, cookie…) are masked.
- A profile that is switched on but incomplete says what it still needs, and goes live the moment it is filled in.
- Copies of a profile start switched off.
- Adding a profile selects its name; adding a URL pattern or header puts the cursor in the new field.
- "How matching works" on the options page is collapsed by default, and opens on its own when there are no
  profiles yet.
- The toolbar badge and the "N active" count include only profiles that are actually rewriting headers.

### Compatibility

The settings and export format are unchanged. Files exported from 1.0.0 import into 1.1.0, and the reverse.

## 1.0.0

First release.
