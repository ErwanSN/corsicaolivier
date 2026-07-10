import { describe, expect, it } from "vitest";
import { type PortMapConfig } from "@corsica/contracts";

import { CorsicaApiClient, type ApiClientError } from "./index";

describe("CorsicaApiClient", () => {
  it("normalizes the base URL and parses auth sessions", async () => {
    const fetcher = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      expect(input).toBe("http://localhost:3001/api/v1/auth/login");
      expect(init?.method).toBe("POST");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(new Headers(init?.headers).get("traceparent")).toMatch(
        /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/
      );
      expect(init?.body).toBe(
        JSON.stringify({ identifier: "client@example.com", password: "password123" })
      );

      return Promise.resolve(
        Response.json({
          accessToken: "token",
          refreshToken: "refresh-token",
          tokenType: "Bearer",
          user: {
            createdAt: "2026-07-02T12:00:00.000Z",
            email: "client@example.com",
            id: "00000000-0000-4000-8000-000000000000",
            role: "USER",
            username: "client"
          }
        })
      );
    };
    const client = new CorsicaApiClient({
      baseUrl: "http://localhost:3001/",
      fetcher
    });

    await expect(
      client.login({
        identifier: "client@example.com",
        password: "password123"
      })
    ).resolves.toMatchObject({
      accessToken: "token",
      refreshToken: "refresh-token",
      tokenType: "Bearer"
    });
  });

  it("rejects invalid request timeout configuration", () => {
    expect(
      () =>
        new CorsicaApiClient({ baseUrl: "http://localhost:3001", requestTimeoutMilliseconds: 0 })
    ).toThrow(/requestTimeoutMilliseconds/);
  });

  it("throws typed API errors", async () => {
    const expectedError = {
      code: "AUTH_INVALID_CREDENTIALS",
      message: "Email ou mot de passe incorrect.",
      requestId: "11111111-1111-4111-8111-111111111111",
      status: 401
    } satisfies Partial<ApiClientError>;
    const fetcher = (): Promise<Response> =>
      Promise.resolve(
        Response.json(
          {
            code: expectedError.code,
            message: expectedError.message,
            requestId: expectedError.requestId
          },
          {
            status: expectedError.status
          }
        )
      );
    const client = new CorsicaApiClient({
      baseUrl: "http://localhost:3001",
      fetcher
    });

    await expect(
      client.login({
        identifier: "client@example.com",
        password: "password123"
      })
    ).rejects.toMatchObject(expectedError);
  });

  it("uses the cookie-only web login contract without a token payload", async () => {
    const fetcher = (input: RequestInfo | URL): Promise<Response> => {
      expect(input).toBe("http://localhost:3001/api/v1/auth/web/login");
      return Promise.resolve(
        Response.json({
          createdAt: "2026-07-02T12:00:00.000Z",
          email: "client@example.com",
          id: "00000000-0000-4000-8000-000000000000",
          role: "USER",
          username: "client"
        })
      );
    };
    const client = new CorsicaApiClient({ baseUrl: "http://localhost:3001", fetcher });

    const user = await client.loginWeb({
      identifier: "client@example.com",
      password: "password123"
    });
    expect("accessToken" in user).toBe(false);
  });

  it("sends authenticated port configuration updates", async () => {
    const configuration: PortMapConfig = { points: [], routes: [], version: 3 };
    const fetcher = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      expect(input).toBe("http://localhost:3001/api/v1/port-map");
      expect(init?.method).toBe("PUT");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer admin-token");
      expect(init?.body).toBe(JSON.stringify(configuration));
      return Promise.resolve(Response.json(configuration));
    };
    const client = new CorsicaApiClient({ baseUrl: "http://localhost:3001", fetcher });
    await expect(client.updatePortMapConfiguration("admin-token", configuration)).resolves.toEqual(
      configuration
    );
  });

  it("creates and validates a persisted staff control", async () => {
    const dossierId = "93620490-0000-4000-8000-000000000001";
    const response = {
      controlledAt: "2026-07-10T08:00:00.000Z",
      controlledBy: "agent",
      dossierId,
      id: "00000000-0000-4000-8000-000000000301",
      reference: "9362049",
      route: "MRS - ILR",
      status: "valide" as const
    };
    const fetcher = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      expect(input).toBe("http://localhost:3001/api/v1/controls");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify({ dossierId, status: "valide" }));
      return Promise.resolve(Response.json(response));
    };
    const client = new CorsicaApiClient({ baseUrl: "http://localhost:3001", fetcher });
    await expect(client.createControl(undefined, { dossierId, status: "valide" })).resolves.toEqual(
      response
    );
  });

  it("renouvelle une session web expirée une seule fois avant de rejouer la requête", async () => {
    const calls: string[] = [];
    const user = {
      createdAt: "2026-07-02T12:00:00.000Z",
      email: "client@example.com",
      id: "00000000-0000-4000-8000-000000000000",
      role: "USER" as const,
      username: "client"
    };
    const fetcher = (input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      calls.push(url);
      if (url.endsWith("/web/refresh")) return Promise.resolve(Response.json(user));
      if (calls.filter((call) => call.endsWith("/me")).length === 1) {
        return Promise.resolve(Response.json({}, { status: 401 }));
      }
      return Promise.resolve(Response.json(user));
    };
    const client = new CorsicaApiClient({ baseUrl: "http://localhost:3001", fetcher });

    await expect(client.me()).resolves.toEqual(user);
    expect(calls).toEqual([
      "http://localhost:3001/api/v1/auth/me",
      "http://localhost:3001/api/v1/auth/web/refresh",
      "http://localhost:3001/api/v1/auth/me"
    ]);
  });

  it("mutualise la rotation pour les requêtes web concurrentes", async () => {
    let meCalls = 0;
    let refreshCalls = 0;
    const user = {
      createdAt: "2026-07-02T12:00:00.000Z",
      email: "client@example.com",
      id: "00000000-0000-4000-8000-000000000000",
      role: "USER" as const,
      username: "client"
    };
    const fetcher = async (input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith("/web/refresh")) {
        refreshCalls += 1;
        await Promise.resolve();
        return Response.json(user);
      }
      meCalls += 1;
      return meCalls <= 2 ? Response.json({}, { status: 401 }) : Response.json(user);
    };
    const client = new CorsicaApiClient({ baseUrl: "http://localhost:3001", fetcher });

    await expect(Promise.all([client.me(), client.me()])).resolves.toEqual([user, user]);
    expect(refreshCalls).toBe(1);
    expect(meCalls).toBe(4);
  });
});
