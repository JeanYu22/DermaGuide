# Versioning & Rollback

Each milestone is marked with an **annotated git tag** so you can always return
to a known-good version if a new update misbehaves.

## Release checkpoints

| Tag | Commit | What it contains |
| --- | --- | --- |
| `v1.0.0` | `cad8794` | Stable storefront: working AI skin analysis, human-skin gate, feedback calibration, recommendations with reasons/how-to-use. **Last version before dropshipping.** |
| `v1.1.0` | `daad601` | Dropshipping supplier framework (AliExpress API + Spocket/BeautyJoint feed import) + versioning tooling. |
| `v1.2.0` | `6c02f45` | Dropshipping sourcing criteria (organic/EU/€1-10/MOQ-1), realistic demo catalogue with stock images, optional auto-SKU + duplicate-name guard, paginated searchable product **grid** (replaces carousel), real product images everywhere, admin thumbnails/search, **AI ingredient-based recommendation agent** (replaces keyword matching), admin uploads + AI label extraction, helper scripts (make-admin, db:info/backup/restore). |
| `v1.3.0` | `737ecd0` | **Body-part-specific analyzer** (face/neck/hand/arm/leg/foot/back/chest metrics) + medical-safety flag; **face-only ML** cross-check; horizontal recommendation cards with large images (4-10 picks); **7-language i18n** (English + Traditional Chinese, Korean, French, Indonesian, Japanese, Arabic RTL); **PayPal + credit/debit card** checkout (sandbox-gated); redesigned landing with animated AI-nurse avatar, mission/vision. |
| `v1.4.0` | branch tip | **Full UI/UX redesign — "DermaGuide" design system.** Adapted from the "Skin Check" clinical-scan promo video (leaf mark, clinical scan ring, friendly nurse Lily, clean score/meter/chart dashboard) with the reference HTML's colour tone & dashboard presentation: porcelain surfaces, coral CTAs, sage + clinical-blue accents, deep-cocoa text, Playfair serif headings, glassmorphism cards, rounded radii, soft shadows. New **conic score-ring** gauge + **severity-graded metric meters** in the analyzer, radar chart recoloured to the new palette, rebranded PureGlow → DermaGuide throughout, refreshed landing/shop/chat/analyzer/cart/admin surfaces. Functionality, i18n hooks, and data flows unchanged. **Snapshot after the design overhaul.** |

### Create the checkpoint tags (one-time, from your own machine)

Tags can't be pushed from the build environment (its GitHub access is scoped to
the branch). Run this once locally to publish them:

```bash
git fetch origin
git tag -a v1.0.0 cad8794 -m "Stable storefront before dropshipping"
git tag -a v1.1.0 daad601 -m "Dropshipping milestone"
git tag -a v1.2.0 6c02f45 -m "Shop Product demo built"
git tag -a v1.3.0 737ecd0 -m "Body-part analyzer, i18n, payments, new landing"
git tag -a v1.4.0 origin/claude/shop-app-commercialize-j0yc77 -m "DermaGuide UI/UX redesign"
git push origin v1.0.0 v1.1.0 v1.2.0 v1.3.0 v1.4.0
```

Even without tags, **every commit is a restore point**. The v1.2.0 snapshot is
the current branch tip (commit shown by `git log --oneline -1` / `/api/version`);
`cad8794` is the pre-dropshipping rollback target.

List every checkpoint at any time:

```bash
git tag -l            # list tags
git show v1.0.0       # see what a tag points to
```

## How to roll back

### Option A — Try an old version without changing anything (safest)
Check it out in "detached HEAD" mode, test it, then come back:

```bash
git checkout v1.0.0      # run the old version locally
npm install && npm start
# …test…
git checkout claude/shop-app-commercialize-j0yc77   # return to latest
```

### Option B — Undo a bad update but KEEP history (recommended for shared work)
`git revert` makes a NEW commit that undoes the change. Nothing is lost, and
it's safe to push.

```bash
# undo just the dropshipping commit:
git revert daad601
git push

# or undo everything since the last good tag:
git revert --no-commit v1.0.0..HEAD
git commit -m "Roll back to v1.0.0 behaviour"
git push
```

### Option C — Hard reset the branch to a tag (rewrites history)
Use only if you're sure and it's your own branch. This discards commits after
the tag and requires a force-push.

```bash
git reset --hard v1.0.0
git push --force-with-lease origin claude/shop-app-commercialize-j0yc77
```

> Prefer **Option B** on any branch others might use. Use **Option C** only on a
> personal branch.

## Tagging the next milestone

When the next milestone is stable:

```bash
git tag -a v1.2.0 -m "Describe what this milestone adds"
git push origin v1.2.0
```

Use semantic-ish versions: bump the **minor** (1.1 → 1.2) for new features, the
**patch** (1.1.0 → 1.1.1) for fixes, the **major** (1.x → 2.0) for breaking
changes.

## Important: code rollback ≠ data rollback

Git only versions **code**, not your MongoDB **data**. All schema changes so
far are *additive* (new fields with defaults, new collections), so rolling the
code back is safe — old code simply ignores the newer fields. But to be fully
protected, **back up the database before each milestone**:

```bash
# Back up (creates ./backups/<timestamp>/dermaguide)
mongodump --uri "mongodb://localhost:27017" --db dermaguide --out "backups/$(date +%Y%m%d-%H%M%S)"

# Restore a backup
mongorestore --uri "mongodb://localhost:27017" --drop "backups/<timestamp>/dermaguide"
```

On Windows PowerShell:

```powershell
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
mongodump --uri "mongodb://localhost:27017" --db dermaguide --out "backups/$ts"
```

`npm run db:backup` / `npm run db:restore` wrap these (see `package.json`).
