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

The workbench's embedded directory/profile panels have a second boundary: mounting them only after
a tap exposed an empty placeholder while Skyline injected the component. The current fix keeps both
nodes in the initial Page tree, gates unauthorized directory group IDs to the empty value, reports a
low-cardinality `panelready` event and shows a loading surface until the host is ready. Profile no
longer uses a same-package placeholder; the cross-package directory placeholder remains required.

The touched panels also replace unsupported Grid/sticky layout, remove the zero-height swiper, add
typed scroll views and restore a definite standalone Profile Page height/leaf declaration. Automated
guards pass; Android verification remains required because a local green build is not native proof.
