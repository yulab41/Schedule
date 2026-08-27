# Mini Page boundary

Android Skyline proved that a Page whose entire template injects one large business panel can fail
before `Page.onLoad` under `requiredComponents`. Height, upload trimming, API, and capability were
ruled out; direct Page registration restored the visitor page on device.

Rules:

- Keep `lazyCodeLoading: requiredComponents`; the official compiler rejects its removal.
- Registered pages statically include/import panel WXML/WXSS and declare only leaf UI components.
- Preserve controller receiver binding and lifecycle with `.call(this)` or the tested host adapter.
- Do not filter component `index.js` when workbench still embeds it; filter only unreachable bundle
  entries.
- Run the thin-page guard and all WXML-handler registration tests.

Device status remains pending for the consolidated candidate; a local green build is not Android
proof.
