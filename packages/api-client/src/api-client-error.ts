import { type ApiErrorDto } from "@corsica/contracts";

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

export function getApiClientErrorMessage(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : "Impossible de contacter le serveur local.";
}
