import { test } from "node:test";
import assert from "node:assert/strict";
import config from "../next.config.ts";

test("every route sends defense-in-depth security headers (Module 8 security review)", async () => {
  assert.equal(config.poweredByHeader, false);
  const rules = await config.headers!();
  const all = rules.find(rule => rule.source === "/:path*");
  assert.ok(all, "a catch-all header rule must exist");
  const headers = new Map(all.headers.map(header => [header.key.toLowerCase(), header.value]));
  const csp = headers.get("content-security-policy") ?? "";
  for (const directive of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "connect-src 'self'"]) {
    assert.ok(csp.includes(directive), `CSP must include ${directive}`);
  }
  if (process.env.NODE_ENV !== "development") assert.ok(!csp.includes("'unsafe-eval'"), "unsafe-eval is development-only");
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.match(headers.get("permissions-policy") ?? "", /geolocation=\(\)/);
});
