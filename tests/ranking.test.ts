import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFilters, parseId, InputError } from "../src/lib/input.ts";
import { isOutdated } from "../src/lib/freshness.ts";
import { rankWorkspaces, scoreWorkspace } from "../src/lib/ranking.ts";
import type { Workspace } from "../src/lib/model.ts";

export const sample: Workspace = {
  id: 1, name: "Alpha", category: "Library", area: "North", address: "1 Fictional Lane", description: null,
  noise_level: "Quiet", wifi: 1, outlets: 1, group_friendly: 0, cost_band: "Free", opening_hours: null,
  collection_method: null, source_note: null, observation_ref: null, source_url: null, last_verified_date: null, published: 1, is_demo: 1,
};
test("Quiet Study earns 4 points", () => assert.equal(scoreWorkspace(sample, "Quiet Study").score, 4));
test("Group Discussion earns 4 points", () => assert.equal(scoreWorkspace({ ...sample, group_friendly: 1, noise_level: "Lively" }, "Group Discussion").score, 4));
test("Remote Work earns 5 points", () => assert.equal(scoreWorkspace(sample, "Remote Work").score, 5));
test("Unknown attributes earn no points and no reasons", () => {
  const unknown = { ...sample, noise_level: null, wifi: null, outlets: null, group_friendly: null };
  for (const task of ["Quiet Study", "Group Discussion", "Remote Work"] as const) {
    const result = scoreWorkspace(unknown, task);
    assert.equal(result.score, 0); assert.equal(result.explanation, "No verified task match.");
  }
});
test("explanations only mention verified matches", () => {
  const result = scoreWorkspace({ ...sample, wifi: null, outlets: 0 }, "Quiet Study");
  assert.equal(result.score, 2); assert.match(result.explanation!, /quiet environment/);
  assert.doesNotMatch(result.explanation!, /Wi-Fi|power outlets/);
});
test("ranking uses score, case-insensitive name, then numeric ID without mutating input", () => {
  const input = [{ ...sample, id: 3, name: "alpha" }, { ...sample, id: 2, name: "Alpha" }, { ...sample, id: 8, name: "Beta" }, { ...sample, id: 9, name: "Aardvark", wifi: 0 as const }];
  assert.deepEqual(rankWorkspaces(input, "Quiet Study").map(workspace => workspace.id), [2, 3, 8, 9]);
  assert.equal(input[0].id, 3);
  assert.deepEqual(rankWorkspaces(input, "Quiet Study"), rankWorkspaces(input, "Quiet Study"));
});
test("search trims whitespace and accepts empty input", () => {
  assert.equal(parseFilters(new URLSearchParams({ search: "  Alpha  " })).search, "Alpha");
  assert.equal(parseFilters(new URLSearchParams()).search, "");
});
test("illegal enum, boolean, repeated parameters and long search are rejected", () => {
  for (const query of ["task=AI", "category=Beach", "noise=Loud", "cost=Cheap", "wifi=false", "search=a&search=b", "extra=1", `search=${"a".repeat(101)}`, "search=%00"]) assert.throws(() => parseFilters(new URLSearchParams(query)), InputError);
  assert.equal(parseFilters(new URLSearchParams({ search: "a".repeat(100) })).search.length, 100);
});
test("freshness calendar boundary: 90 days fresh, 91 stale; unknown remains unknown", () => {
  const now = new Date("2026-11-06T23:59:59Z");
  assert.equal(isOutdated("2026-08-08", now), false);
  assert.equal(isOutdated("2026-08-07", now), true);
  assert.equal(isOutdated(null, now), false);
});

test("workspace IDs require canonical positive safe integers", () => {
  assert.equal(parseId("1"), 1);
  assert.equal(parseId(String(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER);
  for (const value of ["", "0", "-1", "01", "+1", "1.0", "1e3", " 1 ", "1 OR 1=1", "9007199254740992"]) {
    assert.throws(() => parseId(value), InputError);
  }
});

test("search length is validated before trimming whitespace", () => {
  const accepted = ` ${"a".repeat(98)} `;
  const rejected = ` ${"a".repeat(99)} `;
  assert.equal(parseFilters(new URLSearchParams({ search: accepted })).search, "a".repeat(98));
  assert.throws(() => parseFilters(new URLSearchParams({ search: rejected })), InputError);
});