import { describe, expect, it } from "vitest";

import { CorsicaApiClient, type ApiClientError } from "./index";

describe("CorsicaApiClient", () => {
  it("normalizes the base URL and parses auth sessions", async () => {
    const fetcher = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      expect(input).toBe("http://localhost:3001/api/v1/auth/login");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(
        JSON.stringify({ email: "client@example.com", password: "password123" })
      );

      return Promise.resolve(
        Response.json({
          accessToken: "token",
          tokenType: "Bearer",
          user: {
            createdAt: "2026-07-02T12:00:00.000Z",
            email: "client@example.com",
            id: "00000000-0000-4000-8000-000000000000"
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
        email: "client@example.com",
        password: "password123"
      })
    ).resolves.toMatchObject({
      accessToken: "token",
      tokenType: "Bearer"
    });
  });

  it("throws typed API errors", async () => {
    const expectedError = {
      code: "AUTH_INVALID_CREDENTIALS",
      message: "Email ou mot de passe incorrect.",
      status: 401
    } satisfies Partial<ApiClientError>;
    const fetcher = (): Promise<Response> =>
      Promise.resolve(
        Response.json(
          {
            code: expectedError.code,
            message: expectedError.message
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
        email: "client@example.com",
        password: "password123"
      })
    ).rejects.toMatchObject(expectedError);
  });
});
