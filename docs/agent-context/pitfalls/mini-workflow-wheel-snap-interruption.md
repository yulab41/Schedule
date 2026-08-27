# Mini workflow wheel snap interruption

The workflow month picker uses two enhanced vertical `scroll-view` columns with native inertia and
a short controlled snap. A new touch must own the wheel immediately, including during the prior
snap's 320ms animation window.

The regression sequence is: scroll in one direction, let `scrollend` start the controlled snap,
touch the same wheel again, receive a stale old `scrollend`, then drag in the opposite direction.
The old implementation kept `wheelSnapAnimating=true`, ignored the reverse `scroll`, and could let
the stale end event restart the old snap.

Keep these invariants:

- `startWheelTouch` interrupts the same wheel's active animation timer and owner.
- `snapWheel` does nothing while that wheel is still being touched.
- Native scrolling and the new gesture win; only the final stopped position is snapped.
- Month/date values still emit only from the explicit completion action; cancel emits nothing.

The guard must model the stale `scrollend`, not only cancel the timer. Treat this fix as a hypothesis
again if the event bindings, animation ownership, snap timing, or wheel architecture changes.
