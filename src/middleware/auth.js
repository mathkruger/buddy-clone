import jwt from "jsonwebtoken";
import { normalizeUsername } from "../repository/store.js";

// Read the session JWT from either the `Authorization: Bearer <jwt>` header
// (used by API clients) or the `buddy_token` cookie (used by SSR pages).
function readToken(req, cookieName) {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    const value = header.slice("Bearer ".length).trim();
    if (value) return value;
  }
  const raw = req.headers.cookie;
  if (typeof raw === "string") {
    for (const part of raw.split(";")) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      const name = part.slice(0, eq).trim();
      if (name !== cookieName) continue;
      const value = part.slice(eq + 1).trim();
      if (value) {
        try {
          return decodeURIComponent(value);
        } catch {
          return value;
        }
      }
    }
  }
  return null;
}

// Optional auth: resolve whatever valid session the request carries into
// `req.auth = { username }`; anonymous requests stay `req.auth = null`.
// Invalid, expired, or malformed tokens are treated as no session at all.
export function attachUser(config) {
  return (req, res, next) => {
    const token = readToken(req, config.cookieName);
    if (!token) {
      req.auth = null;
      return next();
    }
    try {
      const payload = jwt.verify(token, config.secret);
      req.auth = { username: normalizeUsername(payload.sub) };
    } catch {
      req.auth = null;
    }
    next();
  };
}

// Page-route guard: anonymous visitors get sent to the login page.
export function requireAuth(req, res, next) {
  if (!req.auth) return res.redirect("/login");
  next();
}

// API-route guard: anonymous callers get a 401 back.
export function requireAuthApi(req, res, next) {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

// Owner guard: the caller must be authenticated as the targeted username.
// Anonymous callers get 401; anyone else logged in gets 403.
export function requireOwner(req, res, next) {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const target = normalizeUsername(req.params.username || (req.body && req.body.username) || "");
  if (req.auth.username !== target) {
    return res.status(403).json({ error: "You can only modify your own profile" });
  }
  next();
}