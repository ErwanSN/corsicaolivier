import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const algorithm = "scrypt";
const dummyKey = Buffer.from(
  "XnrV_dImT6m8wCG2wjIn75dUJ-sudZsB7r6d1oK7tr8udjZbYqBEKM11Dwzr1hxa4BDG_amfhwASyENTrtW_kA",
  "base64url"
);
const dummySalt = "corsica-auth-dummy-v1";
const encodedKeyLength = 86;
const keyLength = 64;
const version = "v1";

type PasswordHashMaterial = Readonly<{ key: Buffer; salt: string; valid: boolean }>;

const dummyMaterial: PasswordHashMaterial = { key: dummyKey, salt: dummySalt, valid: false };

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
  const material = parsePasswordHash(passwordHash);
  const candidateKey = await scryptAsync(password, material.salt, keyLength);

  return material.valid && timingSafeEqual(candidateKey, material.key);
}

function parsePasswordHash(passwordHash: string): PasswordHashMaterial {
  const [storedAlgorithm, storedVersion, salt, storedKey] = passwordHash.split("$");
  if (
    storedAlgorithm !== algorithm ||
    storedVersion !== version ||
    !isValidSalt(salt) ||
    !isBoundedEncodedKey(storedKey)
  ) {
    return dummyMaterial;
  }

  const key = Buffer.from(storedKey, "base64url");
  return key.length === keyLength && key.toString("base64url") === storedKey
    ? { key, salt, valid: true }
    : dummyMaterial;
}

export async function verifyPasswordOrDummy(
  password: string,
  passwordHash: string | undefined
): Promise<boolean> {
  const matches = await verifyPassword(
    password,
    passwordHash ?? `${algorithm}$${version}$${dummySalt}$${dummyKey.toString("base64url")}`
  );
  return passwordHash !== undefined && matches;
}

function isValidSalt(value: string | undefined): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 128;
}

function isBoundedEncodedKey(value: string | undefined): value is string {
  return typeof value === "string" && value.length === encodedKeyLength;
}
