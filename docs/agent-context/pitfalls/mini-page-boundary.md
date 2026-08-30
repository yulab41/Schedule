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
The approved successor is one Page shell with a rewritten single-lifecycle Profile workspace and
serial ready events for directory/profile/swap. Unauthorized workspaces keep a fixed disabled
explanation and do not mount or request their business component. The .66 outer native swiper
experiment proved that `disable-touch` was not honored, and true-device evidence then invalidated the
fallback reject handler: the native swiper could still move physically while its disabled change
handler left `activeWorkspace` unchanged, so the moved-to item's hidden content appeared blank.
Do not keep an outer native swiper or horizontal gesture handler. Use one deterministic-height
`workspace-host` with five persistent sibling slots, and let bottom-nav clicks be the only owner of
`activeWorkspace`. Keep `primaryWorkspaceSwipeEnabled=false` as a product/build contract and preserve
the directory's native `directory-mode-swiper`; do not add shared negotiation or another outer
horizontal owner unless the product explicitly replaces the directory gesture model.

The touched panels also replace unsupported Grid/sticky layout, remove the zero-height swiper, add
typed scroll views and restore a definite standalone Profile Page height/leaf declaration. Automated
guards must reject click-only loading, initial-tree dual mounting, and reuse of the failed Profile
Page adapter. Automated structure guards plus Android/iOS experience verification remain required
because a local green build is not native proof. For this fix the user explicitly prohibited WeChat
DevTools, simulator, automation, and computer-control verification; interaction evidence must come
from `.68` on physical devices.

Component property observers may run before `attached`. A data-loading panel must not start requests
until it owns a live instance id, and any microtask used to shorten the visible-shell path must capture
the exact runtime object it intends to load. Otherwise several properties updating together can issue
duplicate requests, or an old queued load can mutate the replacement group/permission runtime. Keep
the instance + context serial + query/page key checks on every directory response and test detach,
group/permission changes, in-flight sharing, and old queued work explicitly.
