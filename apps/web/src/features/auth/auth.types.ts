import { type AuthCredentialsDto } from "@corsica/contracts";

export type AuthFormMode = "createAccount" | "signIn";

export type AuthSubmitHandler = (credentials: AuthCredentialsDto) => Promise<void>;
