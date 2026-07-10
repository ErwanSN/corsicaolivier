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

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(authPasswordMaxLength),
  newPassword: z.string().min(authPasswordMinLength).max(authPasswordMaxLength)
});

export const passwordChangeRequestSchema = z.object({
  id: z.uuid(),
  requestedAt: z.string(),
  status: z.literal("PENDING")
});

export const authSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  tokenType: z.literal("Bearer"),
  user: authUserSchema
});

export const refreshSessionSchema = z.object({
  refreshToken: z.string().min(1)
});

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.uuid()
});

export const dossierSearchFieldSchema = z.enum(["dossier", "nom", "telephone", "vehicule"]);
export const travelerStatusSchema = z.enum(["attente", "embarque"]);
export const travelerSchema = z.object({
  dateLabel: z.string().min(1).max(100),
  id: z.uuid(),
  name: z.string().min(1).max(100),
  status: travelerStatusSchema
});
export const vehicleSchema = z.object({
  id: z.uuid(),
  model: z.string().min(1).max(100),
  owner: z.string().min(1).max(100),
  paid: z.boolean(),
  plate: z.string().min(1).max(20)
});
export const dossierSchema = z.object({
  currencyLabel: z.string().min(1).max(100),
  id: z.uuid(),
  phone: z.string().min(1).max(30),
  reference: z.string().min(1).max(30),
  routeLabel: z.string().min(1).max(150),
  travelers: z.array(travelerSchema).max(100),
  vehicles: z.array(vehicleSchema).max(20)
});
export const dossierListSchema = z.array(dossierSchema).max(20);
export const dossierSearchQuerySchema = z.object({
  field: dossierSearchFieldSchema,
  query: z.string().trim().min(2).max(100)
});
export const controlStatusSchema = z.enum(["refuse", "valide"]);
export const controlRecordSchema = z.object({
  controlledAt: z.string(),
  controlledBy: z.string().min(1).max(254),
  dossierId: z.uuid(),
  id: z.uuid(),
  reference: z.string().min(1).max(30),
  route: z.string().min(1).max(150),
  status: controlStatusSchema
});
export const controlRecordListSchema = z.array(controlRecordSchema).max(100);
export const createControlRecordSchema = z.object({
  dossierId: z.uuid(),
  status: controlStatusSchema
});

export const portPointTypeSchema = z.enum(["boarding", "control", "ship", "storage"]);
export const coordinatesSchema = z.tuple([
  z.number().min(-90).max(90),
  z.number().min(-180).max(180)
]);
export const portPointSchema = z.object({
  coordinates: coordinatesSchema,
  id: z.uuid(),
  label: z.string().trim().min(1).max(100),
  type: portPointTypeSchema
});
export const portRouteSchema = z.object({
  geometry: z.array(coordinatesSchema).min(2).max(200),
  id: z.uuid(),
  label: z.string().trim().min(1).max(100),
  pointIds: z.array(z.uuid()).min(2).max(50),
  shipPointId: z.uuid()
});
export const portMapConfigSchema = z
  .object({
    points: z.array(portPointSchema).max(500),
    routes: z.array(portRouteSchema).max(200),
    version: z.literal(3)
  })
  .superRefine((config, context) => {
    const pointsById = new Map(config.points.map((point) => [point.id, point]));
    if (pointsById.size !== config.points.length) {
      context.addIssue({
        code: "custom",
        message: "Les identifiants des points doivent être uniques."
      });
    }
    for (const route of config.routes) {
      const ship = pointsById.get(route.shipPointId);
      if (
        ship?.type !== "ship" ||
        route.pointIds.at(-1) !== route.shipPointId ||
        new Set(route.pointIds).size !== route.pointIds.length ||
        route.pointIds.some((id) => !pointsById.has(id))
      ) {
        context.addIssue({ code: "custom", message: "Un itinéraire référence un point invalide." });
      }
    }
    if (new Set(config.routes.map((route) => route.id)).size !== config.routes.length) {
      context.addIssue({
        code: "custom",
        message: "Les identifiants des itinéraires doivent être uniques."
      });
    }
  });

export type ApiErrorDto = z.infer<typeof apiErrorSchema>;
export type Dossier = z.infer<typeof dossierSchema>;
export type DossierSearchField = z.infer<typeof dossierSearchFieldSchema>;
export type DossierSearchQuery = z.infer<typeof dossierSearchQuerySchema>;
export type ControlRecord = z.infer<typeof controlRecordSchema>;
export type ControlStatus = z.infer<typeof controlStatusSchema>;
export type CreateControlRecord = z.infer<typeof createControlRecordSchema>;
export type TravelerStatus = z.infer<typeof travelerStatusSchema>;
export type AuthCredentialsDto = z.infer<typeof authCredentialsSchema>;
export type AuthSessionDto = z.infer<typeof authSessionSchema>;
export type RefreshSessionDto = z.infer<typeof refreshSessionSchema>;
export type LoginCredentialsDto = z.infer<typeof loginCredentialsSchema>;
export type AuthUserDto = z.infer<typeof authUserSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
export type PasswordChangeRequestDto = z.infer<typeof passwordChangeRequestSchema>;
export type Role = z.infer<typeof roleSchema>;
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export type Coordinates = z.infer<typeof coordinatesSchema>;
export type PortMapConfig = z.infer<typeof portMapConfigSchema>;
export type PortPoint = z.infer<typeof portPointSchema>;
export type PortPointType = z.infer<typeof portPointTypeSchema>;
export type PortRoute = z.infer<typeof portRouteSchema>;
