import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCheckInDue, localDateKey, reminderDecision } from "./reminder-time.ts";

const ZONE = "America/Anchorage";

describe("reminderDecision", () => {
  it("waits until the local reminder time", () => {
    const early = reminderDecision({
      now: new Date("2026-11-08T16:59:00Z"),
      timeZone: ZONE,
      reminderTime: "08:00",
      lastSentKey: null,
      checkedInToday: false,
    });
    assert.equal(early.dateKey, "2026-11-08");
    assert.equal(early.notify, false);

    const due = reminderDecision({
      now: new Date("2026-11-08T17:00:00Z"),
      timeZone: ZONE,
      reminderTime: "08:00",
      lastSentKey: null,
      checkedInToday: false,
    });
    assert.equal(due.notify, true);
    assert.equal(due.markSent, true);
  });

  it("sends once, and skips a day that already has a check-in", () => {
    const again = reminderDecision({
      now: new Date("2026-11-08T18:00:00Z"),
      timeZone: ZONE,
      reminderTime: "08:00",
      lastSentKey: "2026-11-08",
      checkedInToday: false,
    });
    assert.equal(again.notify, false);
    assert.equal(again.markSent, false);

    const done = reminderDecision({
      now: new Date("2026-11-08T17:30:00Z"),
      timeZone: ZONE,
      reminderTime: "08:00",
      lastSentKey: null,
      checkedInToday: true,
    });
    assert.equal(done.notify, false);
    assert.equal(done.markSent, true);
  });

  it("uses the local date around midnight", () => {
    assert.equal(localDateKey(new Date("2026-11-08T08:30:00Z"), ZONE), "2026-11-07");
  });
});

describe("isCheckInDue", () => {
  it("stays due until a check-in lands on that local day", () => {
    const now = Date.parse("2026-11-08T20:00:00Z");
    assert.equal(isCheckInDue(now, "08:00", [], ZONE), true);
    assert.equal(isCheckInDue(now, "08:00", [Date.parse("2026-11-08T18:00:00Z")], ZONE), false);
    assert.equal(isCheckInDue(now, "08:00", [Date.parse("2026-11-07T18:00:00Z")], ZONE), true);
  });
});
