import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { describe, test } from "node:test";

import { computeBackoffDelay, JITTER_FLOOR_RATIO, waitFor } from "../src/backoff.ts";

describe("computeBackoffDelay", () => {
  const config = { baseDelayMs: 100, maxDelayMs: 1000 };

  test("doubles the capped delay per attempt (upper jitter bound)", () => {
    const maxed = { ...config, random: () => 1 };
    assert.equal(computeBackoffDelay(1, maxed), 100);
    assert.equal(computeBackoffDelay(2, maxed), 200);
    assert.equal(computeBackoffDelay(3, maxed), 400);
    assert.equal(computeBackoffDelay(4, maxed), 800);
  });

  test("never exceeds maxDelayMs, even for huge attempt numbers", () => {
    const maxed = { ...config, random: () => 1 };
    assert.equal(computeBackoffDelay(5, maxed), 1000);
    assert.equal(computeBackoffDelay(20, maxed), 1000);
    assert.equal(computeBackoffDelay(1_000_000, maxed), 1000);
  });

  test("jitter keeps the delay within [50%, 100%] of the capped value", () => {
    const base = 100;
    assert.equal(computeBackoffDelay(2, { ...config, random: () => 0 }), base * 2 * JITTER_FLOOR_RATIO);
    assert.equal(computeBackoffDelay(2, { ...config, random: () => 0.25 }), base * 2 * 0.625);
    assert.equal(computeBackoffDelay(2, { ...config, random: () => 0.5 }), base * 2 * 0.75);
    assert.equal(computeBackoffDelay(2, { ...config, random: () => 1 }), base * 2);
  });

  test("clamps out-of-range or non-finite random samples", () => {
    const capped = 200;
    assert.equal(computeBackoffDelay(2, { ...config, random: () => -5 }), capped * 0.5);
    assert.equal(computeBackoffDelay(2, { ...config, random: () => 2 }), capped);
    assert.equal(computeBackoffDelay(2, { ...config, random: () => Number.NaN }), capped);
    assert.equal(computeBackoffDelay(2, { ...config, random: () => Number.POSITIVE_INFINITY }), capped);
  });

  test("500 random samples all land inside the documented range", () => {
    const attempt = 3;
    const capped = 400;
    for (let i = 0; i < 500; i += 1) {
      const delayMs = computeBackoffDelay(attempt, config);
      assert.ok(delayMs >= capped * 0.5, `delay ${delayMs} below jitter floor`);
      assert.ok(delayMs <= capped, `delay ${delayMs} above cap`);
    }
  });

  test("zero base delay yields zero", () => {
    assert.equal(computeBackoffDelay(3, { baseDelayMs: 0, maxDelayMs: 1000, random: () => 1 }), 0);
  });

  test("treats invalid attempt numbers as attempt 1", () => {
    assert.equal(computeBackoffDelay(0, { ...config, random: () => 1 }), 100);
    assert.equal(computeBackoffDelay(-5, { ...config, random: () => 1 }), 100);
    assert.equal(computeBackoffDelay(Number.NaN, { ...config, random: () => 1 }), 100);
  });
});

describe("waitFor", () => {
  test("resolves after the requested delay", async () => {
    const started = Date.now();
    await waitFor(25);
    assert.ok(Date.now() - started >= 20, "resolved too early");
  });

  test("resolves immediately for zero or negative delays", async () => {
    await waitFor(0);
    await waitFor(-10);
  });

  test("rejects with the abort reason when cancelled mid-wait and cleans up", async () => {
    const controller = new AbortController();
    const reason = new Error("cancelled during backoff");
    const waiting = waitFor(60_000, controller.signal);
    await delay(10);
    controller.abort(reason);
    await assert.rejects(waiting, (error: unknown) => error === reason);
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  });

  test("rejects immediately when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("already gone"));
    await assert.rejects(waitFor(1_000, controller.signal));
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  });

  test("removes the abort listener after a normal resolve", async () => {
    const controller = new AbortController();
    await waitFor(10, controller.signal);
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  });
});
