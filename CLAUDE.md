# stuartsingleton.com — notes for Claude sessions

## Testing the live site without polluting analytics
Before any headless / Playwright / automated visit to https://stuartsingleton.com, load
`https://stuartsingleton.com/api/notrack` in that browser context first (sets the
`ss_notrack` cookie; `/api/track` then drops every event from it). Or start at
`/api/notrack?to=/shop` to land on a page. The Meta pixel still fires, so pixel checks work.
If the test is checking `/api/track` itself, skip this and say so in the vault note.

Do not set `localStorage.ss_admin=1` for tests unless you also want the Meta pixel off
(index.html skips both when it is set).

## Git
`main` lives in this worktree (`stuart-singleton-site-main`). `stuart-singleton-site` is on
`sets-preview`. Commit only the files you meant to change; check `git status` first.

## Generated files are rebuilt by CI
`.github/workflows/rebuild-shop-feeds.yml` runs every 6 hours (and on demand from the
Actions tab) and commits to `main` when photos changed: the three catalog CSVs, feed-img/,
print/, prints.html, catalog.json, catalog-titles.json, sitemap.xml, robots.txt.
So `git pull` before working on main, and don't hand-edit those files: change the
generator or the photos table instead. robots.txt comes from generate-sitemap.js.
