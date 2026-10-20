import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import registryModule from "../desktop/registry.cjs";
const { createRegistry } = registryModule;
test("desktop grants persistent access only to explicitly selected supported files", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "moa-registry-"));
  try {
    const file = path.join(dir, "report.txt");
    await writeFile(file, "original document");
    const registryFile = path.join(dir, "data", "registered-files.json");
    const registry = await createRegistry(registryFile);
    assert.throws(() => registry.resolve(file), /등록되지/);
    assert.throws(() => registry.resolve("__proto__"), /등록되지/);
    const [registered] = await registry.add([file]);
    assert.equal(registry.resolve(registered.id), file);
    const restored = await createRegistry(registryFile);
    assert.equal(restored.resolve(registered.id), file);
    assert.equal((await restored.add([file]))[0].id, registered.id);
    const dangerous = path.join(dir, "script.sh");
    await writeFile(dangerous, "echo test");
    await assert.rejects(restored.add([dangerous]), /업무 문서/);
    assert.throws(() => restored.resolve(dangerous), /등록되지/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("concurrent shortcut registrations preserve every original path", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "moa-concurrent-"));
  try {
    const first = path.join(dir, "first.txt"),
      second = path.join(dir, "second.txt");
    await Promise.all([
      writeFile(first, "first original"),
      writeFile(second, "second original"),
    ]);
    const registryFile = path.join(dir, "registered-files.json"),
      registry = await createRegistry(registryFile);
    const [[a], [b]] = await Promise.all([
      registry.add([first]),
      registry.add([second]),
    ]);
    const restored = await createRegistry(registryFile);
    assert.equal(restored.resolve(a.id), first);
    assert.equal(restored.resolve(b.id), second);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
