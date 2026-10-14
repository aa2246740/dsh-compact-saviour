# dsh-compact-saviour 0.2.8

When used with Fusion 0.2.8, compaction resolves the session's frozen physical context model, summary model, effort and output limit before capacity estimation or chunk planning. This fixes planning against the virtual `Fusion/auto` model and then generating against a different route.

The optional `compactionRoutes` v1 service issues an immutable route lease. Cancellation, a changed route or an unloaded owner invalidates the old plan. Requests cannot exceed their reserved output limit, cached estimates include the route revision, and an incomplete or stale summary is not committed. Sessions without a routing owner continue to use Compact Saviour's settings.

The integration was exercised on macOS with GPT-6 Sol max and GLM 5.3 Flash max: a 2048-token summary failed safely without replacing history; a separately frozen 8192-token task compacted successfully. Cancellation and concurrent-session isolation also have synthetic-adapter Host coverage. These results do not reproduce the original approximately 4 GB OOM or establish native Electron UI coverage.

## Validation

All 45 package tests and the shared 10-case Fusion/Host integration suite passed on macOS. Type checking, build, DSHX checks and archive validation passed. Server and client entry files exactly match the previously accepted v9 installation. The integration suite uses synthetic adapters and attempted no network calls. A fresh authenticated Web run was blocked by an expired private browser handoff; no new real-model call was made for this release.
