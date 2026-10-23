import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const fixtures = join(root, ".verification");
mkdirSync(fixtures, { recursive: true });
const target = mkdtempSync(join(fixtures, "package-consumer-"));
const run = (command, args) => execFileSync(command, args, {
  cwd: target,
  stdio: "pipe",
  encoding: "utf8",
  timeout: 60_000,
});

try {
  const pack = execFileSync("npm", ["pack", "--json", "--pack-destination", target], {
    cwd: root,
    encoding: "utf8",
    timeout: 60_000,
  });
  const packed = JSON.parse(pack);
  const artifact = Array.isArray(packed) ? packed[0] : packed[manifest.name];
  assert(artifact && typeof artifact === "object", "npm pack must describe the named package");
  assert.equal(artifact.name, manifest.name);
  assert.equal(artifact.version, manifest.version);
  assert(artifact.files.some((file) => file.path === "dist/context.js"));
  assert(artifact.files.some((file) => file.path === "dist/context.d.ts"));
  assert(artifact.files.every((file) => /^(dist\/|package\.json$|README\.md$|LICENSE$|SECURITY\.md$|CHANGELOG\.md$)/u.test(file.path)));
  writeFileSync(join(target, "package.json"), JSON.stringify({ name: "async-control-consumer", private: true, type: "module" }));
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", join(target, artifact.filename)]);
  const packageRoot = join(target, "node_modules", ...manifest.name.split("/"));
  const installed = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  assert.equal(installed.name, manifest.name);
  assert.equal(installed.version, manifest.version);
  assert.equal(installed.license, manifest.license);
  assert.equal(installed.private, manifest.private);
  assert(existsSync(join(packageRoot, "LICENSE")));
  assert(existsSync(join(packageRoot, "SECURITY.md")));
  const specs = Object.keys(installed.exports).map((key) => key === "." ? installed.name : `${installed.name}${key.slice(1)}`);
  writeFileSync(join(target, "check.mjs"), `
import assert from "node:assert/strict";
import { ContextFence, ActivityTracker, createDeferred, boundary, wait } from ${JSON.stringify(manifest.name)};
for (const spec of ${JSON.stringify(specs)}) await import(spec);
const fence = new ContextFence("first");
const ticket = fence.capture();
assert(Object.isFrozen(ticket));
fence.set("second"); fence.set("first");
assert.equal(fence.accepts(ticket), false);
const current = fence.capture();
assert.equal(fence.accepts(current), true);
assert.equal(fence.accepts(new ContextFence("first").capture()), false);
fence.invalidate(); assert.equal(fence.accepts(current), false);
const work = createDeferred();
const late = fence.capture();
let wrote = false;
const completion = work.promise.then(() => { if (fence.accepts(late)) wrote = true; });
fence.dispose(); work.resolve(); await completion;
assert.equal(wrote, false);
assert.throws(() => fence.capture(), /disposed/);
const changes = [];
const tracker = new ActivityTracker((value) => changes.push(value));
const operation = createDeferred();
tracker.track(operation.promise); operation.resolve(); await tracker.idle();
assert.deepEqual(changes, [true, false]);
assert.equal(await boundary(() => 7, 0), 7);
await wait(0);
console.log("PACKED_ASYNC_CONTROL_PASS: exports, freshness, cross-instance, teardown, activity, boundary, wait");
`);
  const node = run(process.execPath, ["check.mjs"]);
  const bun = run("bun", ["--no-env-file", "check.mjs"]);
  assert(node.includes("PACKED_ASYNC_CONTROL_PASS"));
  assert(bun.includes("PACKED_ASYNC_CONTROL_PASS"));
  writeFileSync(join(target, "check.ts"), `
import { ContextFence, type ContextTicket } from ${JSON.stringify(manifest.name)};
const fence = new ContextFence("first");
const ticket: ContextTicket<string> = fence.capture();
fence.accepts(ticket);
if (false) {
  // @ts-expect-error A mutable fence must not widen through a union alias.
  const wider: ContextFence<string | number> = fence;
  const union = new ContextFence<string | number>("first");
  // @ts-expect-error A mutable union fence must not narrow to string-only context.
  const narrower: ContextFence<string> = union;
  void wider; void narrower;
  // @ts-expect-error Context types remain invariant at admission.
  fence.set(1);
  // @ts-expect-error A numeric context ticket is not a string-context ticket.
  fence.accepts(new ContextFence(1).capture());
  // @ts-expect-error The ticket context is immutable.
  ticket.context = "other";
}
`);
  writeFileSync(join(target, "tsconfig.json"), JSON.stringify({
    compilerOptions: { strict: true, noEmit: true, target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", types: [], skipLibCheck: false },
    files: ["check.ts"],
  }));
  run(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"]);
  run("npm", ["ls", "--all"]);
  run("npm", ["audit", "--omit=dev", "--audit-level=high"]);
  console.log(node.trim());
  console.log(bun.trim());
  console.log(`PACKED_ASYNC_CONTROL_TYPES_PASS: positive and five negative assertions; ${artifact.files.length} files; ${artifact.integrity}`);
} finally {
  rmSync(target, { force: true, recursive: true });
}
