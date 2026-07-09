export type AuthFormMode = "createAccount" | "signIn";

export type AuthSubmitHandler = (
  credentials: Readonly<{ identifier: string; password: string }>
) => Promise<void>;
