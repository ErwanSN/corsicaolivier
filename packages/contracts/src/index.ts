import { z } from "zod";

export const authCredentialsSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(128)
});

export const authUserSchema = z.object({
  createdAt: z.string(),
  email: z.email(),
  id: z.uuid()
});

export const authSessionSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal("Bearer"),
  user: authUserSchema
});

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string()
});

export type ApiErrorDto = z.infer<typeof apiErrorSchema>;
export type AuthCredentialsDto = z.infer<typeof authCredentialsSchema>;
export type AuthSessionDto = z.infer<typeof authSessionSchema>;
export type AuthUserDto = z.infer<typeof authUserSchema>;
