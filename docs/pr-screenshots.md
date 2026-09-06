# Screenshots for pull requests

Capture the affected UI before and after the change, with matching routes,
viewport sizes, and states. Check EN and RU; show changed menus open. Keep the
PNG files outside the source checkout, for example as `en-before.png`,
`en-after.png`, `ru-before.png`, and `ru-after.png` in a temporary directory.

## Capture with Playwright

Run the site locally with `pnpm dev`. Use Playwright with headless Chrome
(`chromium.launch({ headless: true, channel: "chrome" })`; Chrome must be installed)
and a `1440×1080` viewport with `deviceScaleFactor: 1`. Open each affected EN/RU
route, wait for the page to settle and `document.fonts.ready`, then capture with
`page.screenshot({ path: "/absolute/path/to/en-before.png", fullPage: true })`.
Repeat after the change with matching routes and states, inspect the PNGs, then
upload them below. Keep the capture script outside the checkout; use an available
Playwright installation without adding it to the project's dependencies.

## Upload with `gh api`

For this public repository, upload review images as assets of a dedicated
`pr-evidence` GitHub prerelease. This keeps images out of source commits and uses
the existing `gh` authentication, without a browser session. The token needs
repository **Contents: write** for uploads and **Pull requests: write** to edit
the PR. See GitHub's [release asset API](https://docs.github.com/en/rest/releases/assets#upload-a-release-asset)
and the [`gh api` manual](https://cli.github.com/manual/gh_api).

First check whether the shared evidence release exists:

```sh
evidence_repo=limit-115/llang-gap
gh api "repos/$evidence_repo/releases/tags/pr-evidence" --jq .id
```

If it returns **404** and you have repository write access, create it once.
Use this dedicated prerelease for screenshots; keep benchmark/software releases
separate. `make_latest=false` keeps it out of the latest-release slot.

```sh
gh api --method POST "repos/$evidence_repo/releases" \
  -f tag_name=pr-evidence \
  -f target_commitish=main \
  -f name='PR evidence' \
  -f body='Review screenshots only; not a benchmark or software release.' \
  -F draft=false -F prerelease=true -f make_latest=false \
  --jq .id
```

Set the actual PR number and capture directory, then upload the images. The API
expects raw PNG bytes in `--input`, not a JSON or multipart `file` field. Passing
`name` with `-f` alongside `--input` puts it in the URL query string.

```sh
evidence_pr=123 # Replace with the actual PR number.
evidence_dir=/absolute/path/to/screenshots
evidence_revision=$(git rev-parse --short HEAD)
evidence_upload_url=$(gh api "repos/$evidence_repo/releases/tags/pr-evidence" \
  --jq '.upload_url | split("{")[0]')

for evidence_label in en-before en-after ru-before ru-after; do
  gh api --method POST "$evidence_upload_url" \
    -H 'Content-Type: image/png' \
    -f "name=pr-${evidence_pr}-${evidence_revision}-${evidence_label}.png" \
    --input "$evidence_dir/$evidence_label.png" \
    --jq '"![\(.name)](\(.browser_download_url))"' || break
done
```

Each upload prints an image embed. Give new captures unique names if uploading
again at the same revision; an existing asset name returns **422**. Keep old
assets available so earlier review evidence remains readable. For a fork without
write access to this repository, use the same process in your public fork.

## Add the images to the PR

Put the returned embeds in the template's **UI changes** section, labeled by
locale and before/after state. Use `browser_download_url` exactly as returned.
Keep the rest of the PR body intact, including existing bot-managed sections.
Prepare the complete body in a local Markdown file, then update it:

```sh
evidence_body=/absolute/path/to/pr-body.md
gh api --method PATCH "repos/$evidence_repo/pulls/$evidence_pr" \
  -F "body=@$evidence_body" --silent
gh api "repos/$evidence_repo/pulls/$evidence_pr" --jq .body
```

When hosting images in a fork, set `evidence_repo` back to `limit-115/llang-gap`
before editing the upstream PR. Open the PR and verify that the images render.
Upload failures must be reported and resolved; being signed out in the browser
does not prevent this API workflow.
