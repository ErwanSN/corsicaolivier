import { type AuthUserDto } from "@corsica/contracts";

export type WebAuthSession = Readonly<{ user: AuthUserDto }>;
