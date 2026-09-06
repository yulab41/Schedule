import { describe, expect, it } from 'vitest';
import {
  reconcileDetailExpansion,
  toggleDetailExpansion,
} from '../src/features/workbench/detail-expansion.ts';

const context = ['account-a', 'group-a', '2026-09-07'];
const row = (key, membershipId, phones = true) => ({
  key,
  membershipId,
  phoneOptions: phones ? [{ number: '600001' }] : [],
});
const shift = (key, rows) => ({ key, rows });
const single = [shift('day', [row('a', 'm1')]), shift('night', [row('b', 'm1')])];
const reconcile = (previous, groups = single, scope = context) =>
  reconcileDetailExpansion(previous, scope, groups);

describe('per-shift detail phone expansion', () => {
  it('opens multiple single-member shift cards independently', () => {
    expect(reconcile().expanded).toEqual({ a: true, b: true });
  });
  it('counts distinct effective members, independent of row and phone counts', () => {
    const groups = [
      shift('day', [row('a', 'm1'), row('b', 'm1'), row('empty', '')]),
      shift('night', [row('c', 'm1'), row('d', 'm2', false)]),
    ];
    expect(reconcile(undefined, groups).expanded).toEqual({
      a: true,
      b: true,
      empty: false,
      c: false,
      d: false,
    });
    expect(reconcile(undefined, [shift('empty', [row('x', '', false)])]).expanded).toEqual({
      x: false,
    });
  });
  it('preserves independent manual choices on equivalent refreshes and reordered rows', () => {
    let state = reconcile(undefined, [shift('day', [row('a', 'm1'), row('b', 'm2')])]);
    state = toggleDetailExpansion(state, 'a');
    state = toggleDetailExpansion(state, 'b');
    state = reconcile(state, [shift('day', [row('b', 'm2', false), row('a', 'm1')])]);
    expect(state.expanded).toEqual({ a: true, b: true });
    const closed = toggleDetailExpansion(reconcile(), 'a');
    expect(reconcile(closed).expanded).toEqual({ a: false, b: true });
  });
  it('resets only changed membership sets and new rows, never using names or array indices', () => {
    const state = toggleDetailExpansion(reconcile(), 'b');
    expect(
      reconcile(state, [shift('day', [row('a', 'm1'), row('c', 'm2')]), single[1]]).expanded,
    ).toEqual({ a: false, c: false, b: false });
    const changedAssignment = reconcile(state, [
      single[0],
      shift('night', [row('replacement', 'm1')]),
    ]);
    expect(changedAssignment.expanded).toEqual({ a: true, replacement: true });
  });
  it.each([
    ['account-b', 'group-a', '2026-09-07'],
    ['account-a', 'group-b', '2026-09-07'],
    ['account-a', 'group-a', '2026-09-08'],
  ])('resets a changed context %s/%s/%s', (...scope) => {
    const state = toggleDetailExpansion(reconcile(), 'a');
    expect(reconcile(state, single, scope).expanded).toEqual({ a: true, b: true });
  });
  it('ignores stale/unknown row toggles and keeps speculative reconciliation pure', () => {
    const state = reconcile();
    expect(toggleDetailExpansion(state, 'missing')).toBe(state);
    reconcile(state, [shift('day', [row('a', 'm2')])]);
    expect(state).toEqual(reconcile());
  });
});
