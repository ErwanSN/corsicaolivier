import { readdir, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";

const exportDirectory = resolve(process.argv[2] ?? "apps/mobile/dist");
const files = await listFiles(exportDirectory);
const fileDetails = await Promise.all(
  files.map(async (path) => ({ bytes: (await stat(path)).size, path }))
);
const totalBytes = fileDetails.reduce((total, file) => total + file.bytes, 0);
const fontCount = fileDetails.filter((file) => extname(file.path) === ".ttf").length;
const bundles = fileDetails.filter((file) => [".hbc", ".js"].includes(extname(file.path)));
const failures = [];

if (totalBytes > 10 * 1024 * 1024) failures.push("total export exceeds 10 MiB");
if (fontCount > 4) failures.push("more than four font assets were exported");
bundles.forEach((bundle) => {
  if (bundle.bytes > 3 * 1024 * 1024) failures.push(`${bundle.path} exceeds 3 MiB`);
});
if (bundles.length !== 3) failures.push("expected one bundle for web, Android and iOS");

console.log(
  JSON.stringify(
    {
      bundleBytes: Object.fromEntries(bundles.map((bundle) => [bundle.path, bundle.bytes])),
      fileCount: fileDetails.length,
      fontCount,
      totalBytes
    },
    null,
    2
  )
);
if (failures.length > 0) throw new Error(`Mobile export budget failed: ${failures.join(", ")}`);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    })
  );
  return nested.flat();
}
