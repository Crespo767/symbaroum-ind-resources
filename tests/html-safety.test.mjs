import assert from "node:assert/strict";
import test from "node:test";

globalThis.game = { symbaroum: null };

const { sanitizeHtml } = await import("../scripts/utils.mjs");

test("HTML sanitizer escapes content when Foundry is unavailable", () => {
  delete globalThis.foundry;
  assert.equal(
    sanitizeHtml('<img src="x" onerror="alert(1)">'),
    "&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;"
  );
});

test("HTML sanitizer delegates to the public Foundry cleaner", () => {
  globalThis.foundry = {
    utils: {
      cleanHTML: (value) => value.replace(/<script[\s\S]*?<\/script>/gi, "")
    }
  };
  assert.equal(sanitizeHtml("<p>safe</p><script>alert(1)</script>"), "<p>safe</p>");
});
