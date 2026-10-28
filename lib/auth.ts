import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { countUsers, createFirstUser, createSession, deleteSession, findUserByUsername, updatePassword, userForSession } from "./server-db";

const COOKIE = "clintrack_session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const DUMMY_HASH = hashPassword("clintrack-dummy-password");

const attempts = new Map<string, { n: number; reset: number }>();

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const actual = scryptSync(password, Buffer.from(salt, "base64url"), 32);
  const expected = Buffer.from(hash, "base64url");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export function needsSetup() {
  return countUsers() === 0;
}

export function userFromToken(token: string | undefined) {
  if (!token) return null;
  return userForSession(hashToken(token));
}

export async function currentUser() {
  const jar = await cookies();
  return userFromToken(jar.get(COOKIE)?.value);
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

async function writeSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  createSession(hashToken(token), userId, Date.now() + SESSION_MS);
  const jar = await cookies();
  jar.set(COOKIE, token, cookieOptions(SESSION_MS / 1000));
}

export function validateUsername(username: string) {
  return /^[a-zA-Z0-9._-]{3,32}$/.test(username);
}

export function tooManyAttempts(key: string) {
  const now = Date.now();
  const row = attempts.get(key);
  if (!row || row.reset < now) {
    attempts.set(key, { n: 1, reset: now + 15 * 60 * 1000 });
    return false;
  }
  row.n += 1;
  return row.n > 8;
}

export function clearAttempts(key: string) {
  attempts.delete(key);
}

export async function registerAccount(username: string, password: string) {
  if (!needsSetup()) return { error: "An account already exists. Sign in instead.", status: 403 } as const;
  if (!validateUsername(username)) return { error: "Use 3–32 letters, numbers, dots, or hyphens.", status: 400 } as const;
  if (password.length < 8 || password.length > 200) return { error: "Use at least 8 characters.", status: 400 } as const;
  const id = createFirstUser(username, hashPassword(password));
  if (id === null) return { error: "An account already exists. Sign in instead.", status: 403 } as const;
  await writeSession(id);
  return { username } as const;
}

export async function loginAccount(username: string, password: string) {
  const key = username.toLowerCase();
  if (tooManyAttempts(key)) return { error: "Too many attempts. Wait a few minutes and try again.", status: 429 } as const;
  const user = findUserByUsername(username);
  const ok = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return { error: "Those details don’t match an account.", status: 401 } as const;
  clearAttempts(key);
  await writeSession(user.id);
  return { username: user.username } as const;
}

export async function changePassword(current: string, next: string) {
  const session = await currentUser();
  if (!session) return { error: "Sign in again.", status: 401 } as const;
  if (next.length < 8 || next.length > 200) return { error: "Use at least 8 characters.", status: 400 } as const;
  const key = `pw:${session.username.toLowerCase()}`;
  if (tooManyAttempts(key)) return { error: "Too many attempts. Wait a few minutes and try again.", status: 429 } as const;
  const account = findUserByUsername(session.username);
  if (!account || !verifyPassword(current, account.passwordHash)) return { error: "Current password doesn’t match.", status: 401 } as const;
  clearAttempts(key);
  updatePassword(account.id, hashPassword(next));
  return { ok: true } as const;
}

export async function logoutAccount() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) deleteSession(hashToken(token));
  jar.set(COOKIE, "", cookieOptions(0));
}
