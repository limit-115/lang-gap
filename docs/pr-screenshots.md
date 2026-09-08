# PR screenshots

Capture matching before/after routes, viewport and states; EN only unless another language is affected.
Use local Playwright/Chrome, wait for fonts, inspect PNGs and keep them outside the checkout.
Upload through authenticated `gh api`; browser login is unnecessary. Use unique asset names.

```sh
evidence_repo=limit-115/llang-gap
gh api "repos/$evidence_repo/releases/tags/pr-evidence" --jq .id
```

Only on 404, create the dedicated evidence prerelease (repository write access required):

```sh
gh api --method POST "repos/$evidence_repo/releases" -f tag_name=pr-evidence \
  -f target_commitish=main -f name='PR evidence' \
  -F draft=false -F prerelease=true -f make_latest=false
```

Set actual PR/revision-specific filenames and paths; repeat for each before/after image:

```sh
evidence_upload_url=$(gh api "repos/$evidence_repo/releases/tags/pr-evidence" --jq '.upload_url | split("{")[0]')
gh api --method POST "$evidence_upload_url" -H 'Content-Type: image/png' \
  -f name=pr-123-revision-en-before.png \
  --input /absolute/path/en-before.png --jq .browser_download_url
```

Embed each returned URL as `![EN before](URL)` / `![EN after](URL)` in the PR's **UI changes** section.
Update the full template body with `gh pr edit <number> --body-file /absolute/path/pr-body.md`.
Read back the PR and confirm images render. Resolve upload failures; a preview link is not a substitute.
