import express from "express";
import { normalizeUsername } from "../repository/store.js";

export function authRouter(store, services, config) {
  const { auth } = services;
  const router = express.Router();

  // POST /api/auth/login — verify credentials, issue a JWT and set the cookie.
  // Unknown usernames and wrong passwords both answer the same generic 401.
  router.post("/api/auth/login", async (req, res, next) => {
    try {
      const { username, password } = req.body || {};
      const normalized = normalizeUsername(username);
      if (!normalized) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      const ok = await auth.login(req, res, normalized, password);
      if (!ok) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      res.json({ user: { username: normalized } });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/logout — clear the session cookie.
  router.post("/api/auth/logout", (req, res) => {
    auth.clearSessionCookie(res);
    res.status(204).end();
  });

  // GET /api/auth/me — current user from the session, or null when anonymous.
  router.get("/api/auth/me", (req, res) => {
    res.json({ user: req.auth ? { username: req.auth.username } : null });
  });

  return router;
}