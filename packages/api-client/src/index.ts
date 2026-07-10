import {
  apiErrorSchema,
  authSessionSchema,
  authUserSchema,
  controlRecordListSchema,
  controlRecordSchema,
  dossierListSchema,
  dossierSchema,
  passwordChangeRequestSchema,
  portMapConfigSchema,
  type ApiErrorDto,
  type AuthCredentialsDto,
  type AuthSessionDto,
  type AuthUserDto,
  type ChangePasswordDto,
  type ControlRecord,
  type CreateControlRecord,
  type Dossier,
  type DossierSearchQuery,
  type LoginCredentialsDto,
  type PasswordChangeRequestDto,
  type PortMapConfig,
  type UpdateProfileDto
} from "@corsica/contracts";

import { createTraceparent, isWebRefreshEligible } from "./request-policy";

const unknownRequestId = "00000000-0000-4000-8000-000000000000";

type Fetcher = typeof fetch;

export type CorsicaApiClientOptions = Readonly<{
  baseUrl: string;
  fetcher?: Fetcher;
}>;

export class ApiClientError extends Error {
  readonly code: string;
  readonly requestId: string;
  readonly status: number;

  constructor(status: number, error: ApiErrorDto) {
    super(error.message);
    this.code = error.code;
    this.name = "ApiClientError";
    this.requestId = error.requestId;
    this.status = status;
  }
}

export class CorsicaApiClient {
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private webRefreshPromise: Promise<boolean> | null = null;

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

  refresh(refreshToken: string): Promise<AuthSessionDto> {
    return this.request("/api/v1/auth/refresh", {
      body: { refreshToken },
      method: "POST",
      schema: authSessionSchema
    });
  }

  registerWeb(credentials: AuthCredentialsDto): Promise<AuthUserDto> {
    return this.request("/api/v1/auth/web/register", {
      body: credentials,
      method: "POST",
      schema: authUserSchema
    });
  }

  loginWeb(credentials: LoginCredentialsDto): Promise<AuthUserDto> {
    return this.request("/api/v1/auth/web/login", {
      body: credentials,
      method: "POST",
      schema: authUserSchema
    });
  }

  me(accessToken?: string): Promise<AuthUserDto> {
    return this.request("/api/v1/auth/me", {
      ...(accessToken ? { accessToken } : {}),
      method: "GET",
      schema: authUserSchema
    });
  }

  logout(refreshToken?: string): Promise<void> {
    return this.requestEmpty("/api/v1/auth/logout", {
      ...(refreshToken ? { body: { refreshToken } } : {}),
      method: "POST"
    });
  }

  updateProfile(accessToken: string | undefined, profile: UpdateProfileDto): Promise<AuthUserDto> {
    return this.request("/api/v1/auth/me", {
      accessToken,
      body: profile,
      method: "PATCH",
      schema: authUserSchema
    });
  }

  changePassword(accessToken: string | undefined, credentials: ChangePasswordDto): Promise<void> {
    return this.requestEmpty("/api/v1/auth/password", {
      accessToken,
      body: credentials,
      method: "PATCH"
    });
  }

  requestPasswordChange(accessToken?: string): Promise<PasswordChangeRequestDto> {
    return this.request("/api/v1/auth/password-change-requests", {
      accessToken,
      method: "POST",
      schema: passwordChangeRequestSchema
    });
  }

  searchDossiers(accessToken: string | undefined, search: DossierSearchQuery): Promise<Dossier[]> {
    const parameters = new URLSearchParams({ field: search.field, query: search.query });
    return this.request(`/api/v1/dossiers/search?${parameters.toString()}`, {
      accessToken,
      method: "GET",
      schema: dossierListSchema
    });
  }

  getDossier(accessToken: string | undefined, id: string): Promise<Dossier> {
    return this.request(`/api/v1/dossiers/${encodeURIComponent(id)}`, {
      accessToken,
      method: "GET",
      schema: dossierSchema
    });
  }

  getControlHistory(accessToken?: string): Promise<ControlRecord[]> {
    return this.request("/api/v1/controls", {
      accessToken,
      method: "GET",
      schema: controlRecordListSchema
    });
  }

  createControl(
    accessToken: string | undefined,
    control: CreateControlRecord
  ): Promise<ControlRecord> {
    return this.request("/api/v1/controls", {
      accessToken,
      body: control,
      method: "POST",
      schema: controlRecordSchema
    });
  }

  getPortMapConfiguration(): Promise<PortMapConfig> {
    return this.request("/api/v1/port-map", {
      method: "GET",
      schema: portMapConfigSchema
    });
  }

  updatePortMapConfiguration(
    accessToken: string | undefined,
    configuration: PortMapConfig
  ): Promise<PortMapConfig> {
    return this.request("/api/v1/port-map", {
      accessToken,
      body: configuration,
      method: "PUT",
      schema: portMapConfigSchema
    });
  }

  private async requestEmpty(
    path: string,
    options: Readonly<{
      accessToken?: string | undefined;
      body?: unknown;
      method: "PATCH" | "POST";
    }>
  ): Promise<void> {
    const requestInit: RequestInit = {
      credentials: "include",
      headers: {
        ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" })
      },
      method: options.method
    };
    if (options.body !== undefined) requestInit.body = JSON.stringify(options.body);
    await this.performRequest(path, requestInit);
  }

  private async request<Response>(
    path: string,
    options: Readonly<{
      accessToken?: string | undefined;
      body?: unknown;
      method: "GET" | "PATCH" | "POST" | "PUT";
      schema: { parse: (value: unknown) => Response };
    }>
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    const requestInit: RequestInit = {
      credentials: "include",
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
    const response = await this.performRequest(path, requestInit);
    const payload: unknown = await response.json().catch(() => null);

    return options.schema.parse(payload);
  }

  private async performRequest(
    path: string,
    requestInit: RequestInit,
    canRefreshWebSession = true
  ): Promise<Response> {
    const { fetcher } = this;
    const headers = new Headers(requestInit.headers);
    if (!headers.has("traceparent")) headers.set("traceparent", createTraceparent());
    requestInit = { ...requestInit, headers };
    let response = await fetcher(`${this.baseUrl}${path}`, requestInit);
    if (
      response.status === 401 &&
      canRefreshWebSession &&
      !new Headers(requestInit.headers).has("Authorization") &&
      isWebRefreshEligible(path)
    ) {
      if (await this.refreshWebSession()) {
        response = await fetcher(`${this.baseUrl}${path}`, requestInit);
      }
    }
    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      const error = apiErrorSchema.safeParse(payload);
      throw new ApiClientError(
        response.status,
        error.success
          ? error.data
          : {
              code: "API_REQUEST_FAILED",
              message: "Impossible de traiter la réponse du serveur.",
              requestId: unknownRequestId
            }
      );
    }
    return response;
  }

  private async refreshWebSession(): Promise<boolean> {
    if (this.webRefreshPromise) return this.webRefreshPromise;

    const refreshPromise = this.fetcher(`${this.baseUrl}/api/v1/auth/web/refresh`, {
      credentials: "include",
      headers: { traceparent: createTraceparent() },
      method: "POST"
    })
      .then((response) => response.ok)
      .catch(() => false);
    this.webRefreshPromise = refreshPromise;
    try {
      return await refreshPromise;
    } finally {
      if (this.webRefreshPromise === refreshPromise) this.webRefreshPromise = null;
    }
  }
}

export function getApiClientErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "Impossible de contacter le serveur local.";
}
