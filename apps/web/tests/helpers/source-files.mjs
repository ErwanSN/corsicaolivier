import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function* sourceFiles(directory, extensions) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      yield* sourceFiles(path, extensions);
    } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
      yield path;
    }
  }
}
