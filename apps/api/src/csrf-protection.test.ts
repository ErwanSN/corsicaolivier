import { describe, expect, it } from "vitest";

import { shouldRejectCookieWrite } from "./csrf-protection";

const allowedOrigins = ["http://localhost:3000"];

describe("shouldRejectCookieWrite", () => {
  it("rejects cookie-authenticated writes from an unknown or absent origin", () => {
    expect(
      shouldRejectCookieWrite(
        { method: "PUT", origin: "https://evil.example", sessionCookie: "token" },
        allowedOrigins
      )
    ).toBe(true);
    expect(
      shouldRejectCookieWrite({ method: "PATCH", sessionCookie: "token" }, allowedOrigins)
    ).toBe(true);
  });

  it("accepts cookie-authenticated writes from the configured web origin", () => {
    expect(
      shouldRejectCookieWrite(
        { method: "POST", origin: "http://localhost:3000", sessionCookie: "token" },
        allowedOrigins
      )
    ).toBe(false);
  });

  it("does not apply browser CSRF rules to safe reads or Bearer clients", () => {
    expect(shouldRejectCookieWrite({ method: "GET", sessionCookie: "token" }, allowedOrigins)).toBe(
      false
    );
    expect(
      shouldRejectCookieWrite(
        { authorization: "Bearer mobile-token", method: "PUT", sessionCookie: "token" },
        allowedOrigins
      )
    ).toBe(false);
  });
});
