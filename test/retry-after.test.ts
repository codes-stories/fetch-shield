import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { isRetryAfterStatus, parseRetryAfter } from "../src/retry-after.ts";

const NOW = 1_700_000_000_000; // aligned to whole seconds so HTTP-date math is exact

describe("parseRetryAfter", () => {
  test("parses delta-seconds", () => {
    assert.equal(parseRetryAfter("0", NOW), 0);
    assert.equal(parseRetryAfter("1", NOW), 1000);
    assert.equal(parseRetryAfter("120", NOW), 120_000);
    assert.equal(parseRetryAfter("86400", NOW), 86_400_000);
  });

  test("trims surrounding whitespace", () => {
    assert.equal(parseRetryAfter("  5  ", NOW), 5000);
  });

  test("parses HTTP-date as a future delay", () => {
    const header = new Date(NOW + 30_000).toUTCString();
    assert.equal(parseRetryAfter(header, NOW), 30_000);
  });

  test("treats HTTP-dates in the past as zero delay", () => {
    const header = new Date(NOW - 10_000).toUTCString();
    assert.equal(parseRetryAfter(header, NOW), 0);
  });

  test("returns null for missing, empty, or invalid values", () => {
    assert.equal(parseRetryAfter(null, NOW), null);
    assert.equal(parseRetryAfter(undefined, NOW), null);
    assert.equal(parseRetryAfter("", NOW), null);
    assert.equal(parseRetryAfter("   ", NOW), null);
    assert.equal(parseRetryAfter("soon", NOW), null);
    assert.equal(parseRetryAfter("not-a-date", NOW), null);
    assert.equal(parseRetryAfter("5.5", NOW), null);
    assert.equal(parseRetryAfter("-30", NOW), null);
    assert.equal(parseRetryAfter("+5", NOW), null);
  });

  test("treats absurdly large second counts as invalid", () => {
    assert.equal(parseRetryAfter("9".repeat(400), NOW), null);
  });

  test("uses Date.now() by default", () => {
    const header = new Date(Date.now() + 60_000).toUTCString();
    const parsed = parseRetryAfter(header);
    assert.ok(parsed !== null && parsed > 0 && parsed <= 60_000);
  });
});

describe("isRetryAfterStatus", () => {
  test("is true only for 429 and 503", () => {
    assert.equal(isRetryAfterStatus(429), true);
    assert.equal(isRetryAfterStatus(503), true);
    assert.equal(isRetryAfterStatus(500), false);
    assert.equal(isRetryAfterStatus(502), false);
    assert.equal(isRetryAfterStatus(504), false);
    assert.equal(isRetryAfterStatus(200), false);
  });
});
