import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estimateSleep, nightWindow } from "./sleep.ts";

function at(day: number, hour: number, minute: number) {
  return new Date(2026, 10, day, hour, minute, 0, 0).getTime();
}

describe("nightWindow", () => {
  it("uses yesterday evening through this morning", () => {
    const window = nightWindow(at(8, 9, 0));
    assert.equal(window.start, at(7, 18, 0));
    assert.equal(window.end, at(8, 9, 0));
  });

  it("keeps last night when the check-in is in the afternoon", () => {
    const window = nightWindow(at(8, 16, 30));
    assert.equal(window.start, at(7, 18, 0));
    assert.equal(window.end, at(8, 14, 0));
  });
});

describe("estimateSleep", () => {
  it("reads a locked screen as sleep, including one brief wake", () => {
    const estimate = estimateSleep(
      [
        { timestamp: at(7, 22, 0), kind: "input" },
        { timestamp: at(7, 23, 10), kind: "locked" },
        { timestamp: at(8, 3, 0), kind: "unlocked" },
        { timestamp: at(8, 3, 3), kind: "locked" },
        { timestamp: at(8, 6, 50), kind: "unlocked" },
      ],
      at(8, 9, 0),
    );
    assert.ok(estimate);
    assert.equal(estimate.hours, 7.5);
    assert.equal(estimate.quality, "Good");
    assert.equal(estimate.wakes, 1);
    assert.equal(estimate.observed, true);
    assert.equal(estimate.reliable, true);
    assert.equal(estimate.start, at(7, 23, 10));
    assert.equal(estimate.end, at(8, 6, 50));
  });

  it("treats a long gap between uses as an unreliable guess", () => {
    const estimate = estimateSleep(
      [
        { timestamp: at(7, 23, 0), kind: "input" },
        { timestamp: at(8, 7, 0), kind: "active" },
      ],
      at(8, 9, 0),
    );
    assert.ok(estimate);
    assert.equal(estimate.hours, 8);
    assert.equal(estimate.observed, false);
    assert.equal(estimate.reliable, false);
    assert.equal(estimate.quality, "Good");
  });

  it("ignores a short lock and a short gap", () => {
    assert.equal(
      estimateSleep(
        [
          { timestamp: at(7, 23, 0), kind: "locked" },
          { timestamp: at(7, 23, 10), kind: "unlocked" },
        ],
        at(8, 9, 0),
      ),
      null,
    );
    assert.equal(
      estimateSleep(
        [
          { timestamp: at(7, 19, 0), kind: "input" },
          { timestamp: at(7, 20, 0), kind: "input" },
        ],
        at(8, 9, 0),
      ),
      null,
    );
  });

  it("prefers the night over an earlier nap", () => {
    const estimate = estimateSleep(
      [
        { timestamp: at(7, 14, 0), kind: "locked" },
        { timestamp: at(7, 15, 30), kind: "unlocked" },
        { timestamp: at(7, 23, 30), kind: "still" },
        { timestamp: at(8, 6, 0), kind: "moving" },
      ],
      at(8, 9, 0),
    );
    assert.ok(estimate);
    assert.equal(estimate.start, at(7, 23, 30));
    assert.equal(estimate.hours, 6.5);
    assert.equal(estimate.observed, true);
  });

  it("marks broken sleep as poor", () => {
    const marks = [{ timestamp: at(7, 23, 0), kind: "locked" }];
    for (let wake = 0; wake < 3; wake++) {
      const hour = wake + 1;
      marks.push({ timestamp: at(8, hour, 0), kind: "unlocked" }, { timestamp: at(8, hour, 3), kind: "locked" });
    }
    marks.push({ timestamp: at(8, 7, 0), kind: "unlocked" });
    const estimate = estimateSleep(marks, at(8, 9, 0));
    assert.ok(estimate);
    assert.equal(estimate.wakes, 3);
    assert.equal(estimate.quality, "Poor");
  });

  it("keeps an ongoing lock up to the moment you ask", () => {
    const estimate = estimateSleep([{ timestamp: at(7, 23, 0), kind: "locked" }], at(8, 7, 0));
    assert.ok(estimate);
    assert.equal(estimate.observed, true);
    assert.equal(estimate.reliable, true);
    assert.equal(estimate.end, at(8, 7, 0));
    assert.equal(estimate.hours, 8);
  });

  it("does not call steady use sleep", () => {
    const marks = [];
    for (let hour = 18; hour <= 23; hour++) marks.push({ timestamp: at(7, hour, 0), kind: "active" });
    for (let hour = 0; hour <= 8; hour++) marks.push({ timestamp: at(8, hour, 0), kind: "active" });
    assert.equal(estimateSleep(marks, at(8, 9, 0)), null);
  });
});
