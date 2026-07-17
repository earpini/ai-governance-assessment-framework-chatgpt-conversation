import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the policy-window explorer", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Window \| AI governance readiness<\/title>/i);
  assert.match(html, /Where is the next/);
  assert.match(html, /Brazil/);
  assert.match(html, /Four signals, no false precision/);
  assert.match(html, /open-data validation pilot/i);
  assert.match(html, /No synthetic country findings/i);
  assert.match(html, /(Stage not assessed|Evidence available|Collection pending)/i);
  assert.doesNotMatch(html, /Search interest/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
