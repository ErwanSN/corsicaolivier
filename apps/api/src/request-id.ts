import { randomUUID } from "node:crypto";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveRequestId(
  header: string | readonly string[] | undefined,
  generate: () => string = randomUUID
): string {
  if (typeof header !== "string") return generate();
  const candidate = header;
  return candidate && uuidPattern.test(candidate) ? candidate.toLowerCase() : generate();
}
