import { describe, expect, it } from "vitest";

import { mobileAccountCopy } from "./account-copy";

describe("mobileAccountCopy", () => {
  it("exposes distinct experiences for every account role", () => {
    expect(new Set(Object.values(mobileAccountCopy).map(({ title }) => title)).size).toBe(3);
    expect(mobileAccountCopy.USER.title).toBe("Espace client");
    expect(mobileAccountCopy.EMPLOYEE.title).toBe("Espace salarié");
    expect(mobileAccountCopy.ADMIN.title).toBe("Espace administrateur");
  });
});
