# Releasing to the Chrome Web Store

Copy for every text field lives in [docs/store-listing.md](docs/store-listing.md). This file covers what to build
and where each piece goes.

## 1. Prepare

- Bump `version` in `public/manifest.json`, `package.json` and `package-lock.json`. The store rejects a version
  number it has already accepted.
- Add the release to [CHANGELOG.md](CHANGELOG.md).
- Check that everything passes:

```bash
npm test
```

```bash
npm run build
```

## 2. Build the upload

```bash
npm run package
```

This writes `header-havoc-<version>.zip` with `manifest.json` at the archive root, which is the layout the store
requires. Upload that file and nothing else; the zip is gitignored.

If the UI changed, refresh the screenshots too. Start `npm run preview:ui`, then:

```bash
npm run shots
```

## 3. Fill in the dashboard

At [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole):

| Dashboard field                 | Source                                                                       |
|---------------------------------|------------------------------------------------------------------------------|
| Package                         | `header-havoc-<version>.zip`                                                 |
| Store icon (128×128)            | `public/icons/icon-128.png`                                                  |
| Screenshots (1280×800, up to 5) | `docs/store-screenshots/1-profiles.png` to `4-popup.png`                     |
| Short and detailed description  | [docs/store-listing.md](docs/store-listing.md)                               |
| Category                        | Developer Tools                                                              |
| Single purpose                  | [docs/store-listing.md](docs/store-listing.md#single-purpose)                |
| Permission justifications       | [docs/store-listing.md](docs/store-listing.md#permission-justifications)     |
| Data usage                      | Every category **No** — see [docs/store-listing.md](docs/store-listing.md#privacy--data-usage) |
| Visibility                      | **Unlisted** — installable by link, not searchable                           |

The screenshots are 24-bit PNG without alpha, which the store requires. They come from the preview server's
sample data, so they contain no real hostnames. Check any you capture another way before uploading.

## 4. After approval

- Review usually takes a few days; broad host access can lengthen it.
- Switching Unlisted to Public later keeps the same extension ID, so existing installs keep working and keep
  updating. It triggers another review.
- Tag the release in git: `git tag v<version>` and push the tag.
