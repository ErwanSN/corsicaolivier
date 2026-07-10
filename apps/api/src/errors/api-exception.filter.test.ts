import { BadRequestException, ConflictException, HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { toApiError } from "./api-exception.filter";

const requestId = "11111111-1111-4111-8111-111111111111";

describe("toApiError", () => {
  it("preserves explicit business errors and adds correlation", () => {
    expect(
      toApiError(
        new ConflictException({ code: "AUTH_EMAIL_EXISTS", message: "Compte existant." }),
        requestId
      )
    ).toEqual({ code: "AUTH_EMAIL_EXISTS", message: "Compte existant.", requestId });
  });

  it("normalizes framework validation and route errors", () => {
    expect(toApiError(new BadRequestException(["password is required"]), requestId)).toEqual({
      code: "REQUEST_VALIDATION_FAILED",
      message: "La requête contient des données invalides.",
      requestId
    });
    expect(toApiError(new HttpException("Cannot GET /secret", 404), requestId)).toEqual({
      code: "ROUTE_NOT_FOUND",
      message: "Ressource introuvable.",
      requestId
    });
  });

  it("never exposes an unexpected exception message", () => {
    expect(toApiError(new Error("database password leaked"), requestId)).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "Une erreur interne est survenue.",
      requestId
    });
  });
});
