const unsafeMethods = new Set(["DELETE", "PATCH", "POST", "PUT"]);

export type CsrfRequest = Readonly<{
  authorization?: string | undefined;
  method: string;
  origin?: string | undefined;
  sessionCookie?: string | undefined;
}>;

export function shouldRejectCookieWrite(
  request: CsrfRequest,
  allowedOrigins: false | readonly string[]
): boolean {
  if (!unsafeMethods.has(request.method.toUpperCase())) return false;
  if (!request.sessionCookie || request.authorization?.startsWith("Bearer ")) return false;
  return !request.origin || allowedOrigins === false || !allowedOrigins.includes(request.origin);
}
