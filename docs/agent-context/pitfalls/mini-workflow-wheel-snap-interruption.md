# Mini workflow wheel snap interruption

The workflow month picker uses two enhanced vertical `scroll-view` columns. The old implementation
combined CSS snap with a second JS `scroll-top` animation and rebuilt all wheel item styles through
`setData` on every native/programmatic scroll frame. Fast reverse takeover improved after canceling
the JS timer, but slow one-row reversal and animation frame drops remained.

The accepted architecture keeps native CSS snap as the only automatic position owner. Each column
writes pixel position to its own SharedValue from `worklet:onscrollupdate`; 46 stable animated-style
bindings reproduce the prior 19→24px visual through compositor transforms without changing real
font metrics. Logic receives only row-boundary/final indexes through generation/sequence-guarded
`runOnJS` calls.

Keep these invariants:

- No wheel timer, shared animation owner, or per-pixel `bindscroll → setData` path.
- One hundred updates inside one row produce zero `setData` calls.
- Slow `7 → 7.25 → 7.51 → 7.49 → 7` commits down and up exactly once each.
- Delayed generations and out-of-order sequences cannot overwrite the latest gesture.
- Month nodes bind animated styles once after first open and remain hidden/mounted across reopen.
- Native scrolling always wins; `scrollend` records the actual position and never starts another snap.
- Month/date values emit only from explicit completion; cancel emits nothing.

Treat this fix as a hypothesis again if Worklet bindings, SharedValue interpolation, CSS snap
ownership, persistent node mounting, or the guard tests change. Native acceptance remains external.
