import {
  apiErrorSchema,
  authSessionSchema,
  authUserSchema,
  type ApiErrorDto,
  type AuthCredentialsDto,
  type AuthSessionDto,
  type AuthUserDto,
  type LoginCredentialsDto,
  type UpdateProfileDto
} from "@corsica/contracts";

type Fetcher = typeof fetch;

export type CorsicaApiClientOptions = Readonly<{
  baseUrl: string;
  fetcher?: Fetcher;
}>;

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, error: ApiErrorDto) {
    super(error.message);
    this.code = error.code;
    this.name = "ApiClientError";
    this.status = status;
  }
}

export class CorsicaApiClient {
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;

  constructor({ baseUrl, fetcher = fetch }: CorsicaApiClientOptions) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetcher = fetcher;
  }

  register(credentials: AuthCredentialsDto): Promise<AuthSessionDto> {
    return this.request("/api/v1/auth/register", {
      body: credentials,
      method: "POST",
      schema: authSessionSchema
    });
  }

  login(credentials: LoginCredentialsDto): Promise<AuthSessionDto> {
    return this.request("/api/v1/auth/login", {
      body: credentials,
      method: "POST",
      schema: authSessionSchema
    });
  }

  me(accessToken: string): Promise<AuthUserDto> {
    return this.request("/api/v1/auth/me", {
      accessToken,
      method: "GET",
      schema: authUserSchema
    });
  }

  updateProfile(accessToken: string, profile: UpdateProfileDto): Promise<AuthUserDto> {
    return this.request("/api/v1/auth/me", {
      accessToken,
      body: profile,
      method: "PATCH",
      schema: authUserSchema
    });
  }

  private async request<Response>(
    path: string,
    options: Readonly<{
      accessToken?: string;
      body?: unknown;
      method: "GET" | "PATCH" | "POST";
      schema: { parse: (value: unknown) => Response };
    }>
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    const requestInit: RequestInit = {
      headers,
      method: options.method
    };

    if (options.accessToken) {
      headers.Authorization = `Bearer ${options.accessToken}`;
    }

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      requestInit.body = JSON.stringify(options.body);
    }

    // Appel en fonction autonome (this indéfini) : `fetch` natif lève
    // "Illegal invocation" s'il est appelé comme méthode (this = ce client).
    const { fetcher } = this;
    const response = await fetcher(`${this.baseUrl}${path}`, requestInit);
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const error = apiErrorSchema.safeParse(payload);

      throw new ApiClientError(
        response.status,
        error.success
          ? error.data
          : {
              code: "API_REQUEST_FAILED",
              message: "Impossible de traiter la réponse du serveur."
            }
      );
    }

    return options.schema.parse(payload);
  }
}

export function getApiClientErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "Impossible de contacter le serveur local.";
}
