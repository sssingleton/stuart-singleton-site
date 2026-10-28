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
