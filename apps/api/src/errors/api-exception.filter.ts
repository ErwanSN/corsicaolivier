import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import { type ApiErrorDto } from "@corsica/contracts";
import { type FastifyReply, type FastifyRequest } from "fastify";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<FastifyRequest>();
    const reply = context.getResponse<FastifyReply>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;

    if (!(exception instanceof HttpException)) {
      request.log.error({ err: exception, requestId: request.id }, "Unhandled API exception");
    }

    void reply.status(status).send(toApiError(exception, request.id));
  }
}

export function toApiError(exception: unknown, requestId: string): ApiErrorDto {
  if (!(exception instanceof HttpException)) {
    return {
      code: "INTERNAL_SERVER_ERROR",
      message: "Une erreur interne est survenue.",
      requestId
    };
  }

  const response = exception.getResponse();
  if (isBusinessError(response)) return { ...response, requestId };
  const status = exception.getStatus();
  return { ...fallbackForStatus(status), requestId };
}

function isBusinessError(value: unknown): value is Readonly<{ code: string; message: string }> {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof value.code === "string" &&
    "message" in value &&
    typeof value.message === "string"
  );
}

function fallbackForStatus(status: HttpStatus): Readonly<{ code: string; message: string }> {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return {
        code: "REQUEST_VALIDATION_FAILED",
        message: "La requête contient des données invalides."
      };
    case HttpStatus.UNAUTHORIZED:
      return { code: "AUTH_UNAUTHORIZED", message: "Authentification requise." };
    case HttpStatus.FORBIDDEN:
      return { code: "ACCESS_FORBIDDEN", message: "Accès refusé." };
    case HttpStatus.NOT_FOUND:
      return { code: "ROUTE_NOT_FOUND", message: "Ressource introuvable." };
    case HttpStatus.CONFLICT:
      return { code: "RESOURCE_CONFLICT", message: "La ressource existe déjà." };
    default:
      return { code: `HTTP_${String(status)}`, message: "La requête ne peut pas être traitée." };
  }
}
