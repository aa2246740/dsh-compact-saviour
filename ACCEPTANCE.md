# v0.2.5 acceptance — DSH 0.1.7-rc.2

## Verified

- Reproduced the RC2 regression: moving ContextMeter into the composer dock and its popup into a body portal caused the old manual-button assertion to fail.
- All 40 backend tests passed against RC2 AgentLoop/Loader with local mock adapters. They cover rescue after two eligible official failures, manual commands, direct mode, safe queueing, cancellation, transaction integrity, original history preservation and unload restoration.
- TypeScript, client/server build and the external-plugin static contract check passed.
- Pinned Playwright 1.61.1 / Chromium Headless Shell 1228 exercised RC2 and legacy popup layouts, missing/delayed breakdown, percentage correction, ambiguous popup ownership, keyboard access, one-request long hold, cancellation, progress, reduced motion, background pause, terminal-state restoration and session cleanup.
- The installed desktop client was updated through the official plugin manager. Client HMR rebuilt and served the new bundle on the same Host PID. Native desktop inspection confirmed the original context breakdown, manual button and long-press hint.
- The server bundle is byte-identical to the installed 0.2.4 server. Published client runtime code matches the accepted 0.2.5 client; only its generated CSS source-region comment is made portable.

## Limits

The repair and release checks made no live model requests and did not compact user history. They do not measure summary quality, model latency or cost. OAuth/provider setup belongs to the installed provider, not this plugin. Compatibility with future DSH versions is not claimed.

Normal installation uses the official plugin manager or `dsh plugin`, as documented in README. The bundle includes compiled output and has no installation-time build script.
