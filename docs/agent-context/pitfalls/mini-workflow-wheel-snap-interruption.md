# Mini workflow wheel snap interruption

The workflow month picker uses two enhanced vertical `scroll-view` columns. The old implementation
combined CSS snap with a second JS `scroll-top` animation and rebuilt all wheel item styles through
`setData` on every native/programmatic scroll frame. Fast reverse takeover improved after canceling
the JS timer, but slow one-row reversal and animation frame drops remained.

The `.50` UI-thread architecture compiled and uploaded successfully but failed on the target
Android: there was no automatic snap, no size interpolation, and no opacity interpolation. This
means the Summer compile/source audit did not prove the dynamic `worklet:onscrollupdate` plus
`applyAnimatedStyle` bindings actually executed on that runtime. Removing the JS snap also exposed
that CSS snap alone did not provide the required behavior there.

`.50` was rejected by the user and the runtime was restored exactly to the `.49` picker source in a
new forward commit. Keep the failed design/plan as evidence; do not reintroduce it or patch it in
place without a new device-level capability experiment and explicit architecture discussion.

Keep these invariants:

- The shipped rollback must stay byte-equivalent to the `.49` picker runtime until a new approach is approved.
- The `.48` touch-interrupt regression remains guarded; `.50` Worklet/static tests are removed with the rollback.
- Month/date values emit only from explicit completion; cancel emits nothing.

Treat all future wheel fixes as architectural work. Automated Worklet compilation cannot substitute
for native execution evidence.
