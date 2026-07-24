const webRefreshExcludedPaths = new Set([
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/refresh",
  "/api/v1/auth/web/login",
  "/api/v1/auth/web/register",
  "/api/v1/auth/web/refresh"
]);

export function createTraceparent(): string {
  return `00-${randomNonZeroHex(16)}-${randomNonZeroHex(8)}-01`;
}

export function isWebRefreshEligible(path: string): boolean {
  return !webRefreshExcludedPaths.has(path);
}

export function shouldRefreshWebSession(
  response: Response,
  path: string,
  requestInit: RequestInit,
  canRefreshWebSession: boolean
): boolean {
  return (
    response.status === 401 &&
    canRefreshWebSession &&
    !new Headers(requestInit.headers).has("Authorization") &&
    isWebRefreshEligible(path)
  );
}

function randomNonZeroHex(bytes: number): string {
  let value = "";
  while (!value || /^0+$/.test(value)) value = randomHex(bytes);
  return value;
}

function randomHex(bytes: number): string {
  const values = new Uint8Array(bytes);
  const cryptoProvider = (globalThis as unknown as { crypto?: Pick<Crypto, "getRandomValues"> })
    .crypto;
  if (cryptoProvider?.getRandomValues) cryptoProvider.getRandomValues(values);
  else
    values.forEach((_, index) => {
      values[index] = Math.floor(Math.random() * 256);
    });
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}
