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

The workbench's embedded directory/profile panels have a second boundary with two failed extremes.
Mounting only after a tap exposed an empty placeholder. Mounting both large panels in the initial
tree then made workbench startup hang: under the same DevTools/GPU/profile, `.63` workbench rendered
while `.64/.65` login rendered but direct workbench automation and screenshots timed out. The safe
hypothesis is a light initial Page followed by automatic, condition-driven serial mounting after
`Page.onReady`: main-package Profile first, then cross-package directory after `panelready`. Each
wrapper keeps a readable loading surface; an early tap may prioritize its target only after Page ready.
Unauthorized directory group IDs remain the empty value.

The touched panels also replace unsupported Grid/sticky layout, remove the zero-height swiper, add
typed scroll views and restore a definite standalone Profile Page height/leaf declaration. Automated
guards must reject both click-only mounting and initial-tree dual mounting. Android verification
remains required because a local green build is not native proof.
