#!/usr/bin/env python3
"""P1 native Skyline parity evidence for the official MiniTest Minium runner."""

import time

import minium


class P1NativeParityTest(minium.MiniTest):
    """Exercise deterministic P1 fixtures without account or production data."""

    def _capture(self, name):
        path = self.capture(name)
        self.assertTrue(path, "capture returns an artifact path")

    def _settle(self, seconds=0.4):
        time.sleep(seconds)

    def test_foundation_controls(self):
        page = self.app.relaunch("/pages/index/index")
        self.assertTrue(page.wait_for("#p1-foundation", max_timeout=10))
        self._capture("p1-foundation-controls-v1--initial.png")

        page.get_element(
            "#p1-switch-notifications>>>.ui-switch__hit-area", max_timeout=10
        ).tap()
        self.assertTrue(page.data["notifications"])
        self._capture("p1-foundation-controls-v1--notification-on.png")

        page.get_element("#p1-checkbox-contact>>>.ui-choice", max_timeout=10).tap()
        self.assertFalse(page.data["contactChecked"])
        page.scroll_to(260, 200)
        self._settle()
        self._capture("p1-foundation-controls-v1--contact-unchecked.png")

        page.get_element("#p1-radio-week>>>.ui-choice", max_timeout=10).tap()
        self.assertEqual("week", page.data["calendarView"])
        self._capture("p1-foundation-controls-v1--week-selected.png")

    def test_calendar_month(self):
        page = self.app.relaunch("/pages/calendar-poc/index")
        self.assertTrue(page.wait_for("#p1-calendar", max_timeout=10))
        self._capture("p1-calendar-month-v1--initial.png")

        page.get_element(
            "#p1-calendar-month>>>#calendar-cell-1-2026-10-15>>>.calendar-cell",
            max_timeout=10,
        ).tap()
        self.assertEqual("2026-10-15", page.data["selectedBusinessDate"])
        self._capture("p1-calendar-month-v1--selected-date.png")

        page.get_element("#p1-calendar-month>>>#calendar-previous", max_timeout=10).tap()
        self._settle()
        self.assertEqual("2026年9月", page.data["monthLabel"])
        self._capture("p1-calendar-month-v1--previous-month.png")

        next_button = page.get_element("#p1-calendar-month>>>#calendar-next", max_timeout=10)
        next_button.tap()
        self._settle()
        next_button = page.get_element("#p1-calendar-month>>>#calendar-next", max_timeout=10)
        next_button.tap()
        self._settle()
        self.assertEqual("2026年11月", page.data["monthLabel"])
        self._capture("p1-calendar-month-v1--next-month.png")

        page.get_element("#p1-calendar-month>>>#calendar-today", max_timeout=10).tap()
        self._settle()
        gesture = page.get_element("#p1-calendar-month>>>#calendar-gesture", max_timeout=10)
        gesture.move(24, 0, 150, smooth=True)
        self._settle()
        self.assertEqual("2026年10月", page.data["monthLabel"])
        self._capture("p1-calendar-month-v1--rebound.png")

    def test_manual_matrix_daily(self):
        page = self.app.relaunch("/pages/manual-matrix-poc/index", {"mode": "daily"})
        self.assertTrue(page.wait_for("#p1-manual-matrix", max_timeout=10))
        self.assertEqual(49, page.data["logicalCellCount"])
        self._capture("p1-manual-matrix-daily-v1--initial.png")

        scroll = page.get_element("#matrix-scroll", max_timeout=10)
        scroll.scroll_to(left=280, top=0)
        self._settle()
        self._capture("p1-manual-matrix-daily-v1--horizontal-scroll.png")

        page.get_element("#matrix-cell-r0-c6", max_timeout=10).tap()
        self.assertTrue(page.data["rows"][0]["cells"][6]["isSelected"])
        self._capture("p1-manual-matrix-daily-v1--cell-selected.png")

        page.get_element("#matrix-undo", max_timeout=10).tap()
        self.assertFalse(page.data["canUndo"])
        self._capture("p1-manual-matrix-daily-v1--undo.png")

    def test_manual_matrix_maximum(self):
        page = self.app.relaunch("/pages/manual-matrix-poc/index", {"mode": "maximum"})
        self.assertTrue(page.wait_for("#p1-manual-matrix", max_timeout=10))
        self.assertEqual(600, page.data["logicalCellCount"])
        self._capture("p1-manual-matrix-maximum-v1--initial.png")

        scroll = page.get_element("#matrix-scroll", max_timeout=10)
        scroll.scroll_to(left=2200, top=600)
        self._settle()
        self._capture("p1-manual-matrix-maximum-v1--scroll-end.png")

        scroll.scroll_to(left=500, top=600)
        self._settle()
        stale_cell = page.get_element("#matrix-cell-r19-c7", max_timeout=10)
        self.assertIn("is-stale", stale_cell.attribute("class"))
        self._capture("p1-manual-matrix-maximum-v1--stale-cell.png")

        page.get_element("#matrix-cell-r19-c8", max_timeout=10).tap()
        self.assertTrue(page.data["rows"][19]["cells"][8]["isSelected"])
        self._capture("p1-manual-matrix-maximum-v1--cell-selected.png")

        page.get_element("#matrix-undo", max_timeout=10).tap()
        self.assertFalse(page.data["canUndo"])
        self._capture("p1-manual-matrix-maximum-v1--undo.png")
