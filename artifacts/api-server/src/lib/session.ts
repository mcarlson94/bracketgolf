/**
 * Simple cookie-based session for MVP.
 * The userId is stored in a plain cookie. Replace with real auth later.
 * Architecture keeps brackets tied to userId so real auth can be swapped in.
 */
import type { Request, Response } from "express";

const SESSION_COOKIE = "bg_user";

export function getSessionUserId(req: Request): string | null {
  const raw = req.cookies?.[SESSION_COOKIE];
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

export function setSessionUserId(res: Response, userId: string): void {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie(SESSION_COOKIE, userId, {
    httpOnly: true,
    // In production (HTTPS) use SameSite=None so the cookie is sent whether
    // the API and frontend are on the same origin or separate Railway services.
    // In development keep Lax (works fine over the Replit proxy same-origin).
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    maxAge: 60 * 60 * 24 * 30 * 1000, // 30 days
    path: "/",
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}
