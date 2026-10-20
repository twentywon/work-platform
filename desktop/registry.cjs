const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const supported = new Set([
  ".hwp",
  ".hwpx",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".log",
  ".odt",
  ".ods",
  ".odp",
]);
async function createRegistry(filename) {
  let entries = {};
  let pending = Promise.resolve();
  try {
    entries = JSON.parse(await fs.readFile(filename, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  return {
    add(paths) {
      const operation = pending.then(async () => {
        const next = { ...entries },
          result = [];
        for (const candidate of paths) {
          const real = await fs.realpath(candidate);
          if (!supported.has(path.extname(real).toLowerCase()))
            throw Error("업무 문서와 이미지 파일만 등록할 수 있습니다.");
          const stat = await fs.stat(real);
          if (!stat.isFile()) throw Error("파일을 선택해 주세요.");
          const id =
            Object.keys(next).find((k) => next[k] === real) || randomUUID();
          next[id] = real;
          result.push({ id, name: path.basename(real), path: real });
        }
        await fs.mkdir(path.dirname(filename), { recursive: true });
        await fs.writeFile(filename + ".tmp", JSON.stringify(next), {
          mode: 0o600,
        });
        await fs.rename(filename + ".tmp", filename);
        entries = next;
        return result;
      });
      pending = operation.catch(() => {});
      return operation;
    },
    resolve(id) {
      if (typeof id !== "string" || !Object.hasOwn(entries, id))
        throw Error("등록되지 않은 파일입니다. 파일을 다시 등록해 주세요.");
      return entries[id];
    },
  };
}
module.exports = { createRegistry };
