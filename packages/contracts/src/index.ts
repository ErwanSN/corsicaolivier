import { z } from "zod";

export const authPasswordMinLength = 8;
export const authPasswordMaxLength = 128;

export const authCredentialsSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(authPasswordMinLength).max(authPasswordMaxLength)
});

export const loginCredentialsSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(authPasswordMaxLength)
});

export const roleSchema = z.enum(["USER", "EMPLOYEE", "ADMIN"]);

export const usernameMinLength = 3;
export const usernameMaxLength = 30;

export const usernameSchema = z
  .string()
  .trim()
  .min(usernameMinLength)
  .max(usernameMaxLength)
  .regex(/^[a-z0-9._-]+$/i);

export const authUserSchema = z.object({
  createdAt: z.string(),
  email: z.email(),
  id: z.uuid(),
  role: roleSchema,
  username: z.string().min(1)
});

export const updateProfileSchema = z.object({
  username: usernameSchema
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
export type LoginCredentialsDto = z.infer<typeof loginCredentialsSchema>;
export type AuthUserDto = z.infer<typeof authUserSchema>;
export type Role = z.infer<typeof roleSchema>;
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
