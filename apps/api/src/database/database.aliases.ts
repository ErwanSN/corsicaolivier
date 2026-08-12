import type { Database } from './database.types';

/** Application alias derived from the generated PostgreSQL enum. */
export type AppRole = Database['public']['Enums']['app_role'];

type RpcName = keyof Database['public']['Functions'];

type ExtractRpcArgs<FunctionDefinition> = FunctionDefinition extends {
  Args: infer Args;
}
  ? Args
  : never;

type RpcArgs<Name extends RpcName> = ExtractRpcArgs<
  Database['public']['Functions'][Name]
>;

type WithNullableRpcArgs<Args, NullableKey extends PropertyKey> =
  Args extends Record<PropertyKey, unknown>
    ? [NullableKey] extends [keyof Args]
      ? Omit<Args, NullableKey> & {
          [Key in NullableKey]: Args[Key] | null;
        }
      : never
    : never;

/**
 * PostgreSQL does not expose procedure-argument nullability in its catalog.
 * `postgres-meta` therefore emits non-null TypeScript arguments even when a
 * function deliberately accepts SQL NULL. Keep those narrow exceptions out of
 * the reproducible generated file and make every exception explicit at use.
 */
export function nullableRpcArgs<
  Name extends RpcName,
  NullableKey extends keyof RpcArgs<Name>,
>(args: WithNullableRpcArgs<RpcArgs<Name>, NullableKey>): RpcArgs<Name> {
  return args as RpcArgs<Name>;
}
