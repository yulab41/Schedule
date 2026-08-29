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
hypothesis was a light initial Page followed by automatic serial mounting. Further isolation disproved
that for Profile: directory post-ready mounting and the static Profile Page render, while the existing
Profile Component adapter freezes even when mounted alone. Do not adjust that adapter's timing again.
The approved successor is one Page shell with a native Skyline swiper, a rewritten single-lifecycle
Profile workspace, and serial ready events for directory/profile/swap. Unauthorized workspaces keep a
fixed disabled explanation and do not mount or request their business component. The .66 compiler
does not honor disable-touch; use the official horizontal drag gesture handler with
should-accept-gesture=false. Give the native swiper an explicit pixel height: Skyline kept its 150px
default when only absolute top and bottom were supplied. While swipe is disabled, click is the only
workspace state owner and delayed programmatic change events must not overwrite a later click.

The touched panels also replace unsupported Grid/sticky layout, remove the zero-height swiper, add
typed scroll views and restore a definite standalone Profile Page height/leaf declaration. Automated
guards must reject click-only loading, initial-tree dual mounting, and reuse of the failed Profile
Page adapter. Android verification remains required because a local green build is not native proof.
