import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const algorithm = "scrypt";
const keyLength = 64;
const version = "v1";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keyLength: number
) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const key = await scryptAsync(password, salt, keyLength);

  return `${algorithm}$${version}$${salt}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [storedAlgorithm, storedVersion, salt, storedKey] = passwordHash.split("$");

  if (storedAlgorithm !== algorithm || storedVersion !== version || !salt || !storedKey) {
    return false;
  }

  const storedKeyBuffer = Buffer.from(storedKey, "base64url");
  const candidateKey = await scryptAsync(password, salt, storedKeyBuffer.length);

  return (
    candidateKey.length === storedKeyBuffer.length && timingSafeEqual(candidateKey, storedKeyBuffer)
  );
}
