import express from "express";
import { requireAuthApi, requireOwner } from "../middleware/auth.js";

function toStatus(code) {
  switch (code) {
    case "ValidationError":
      return 400;
    case "DuplicateUsernameError":
      return 409;
    case "NotFoundError":
      return 404;
    default:
      return undefined;
  }
}

export function profilesRouter(store, services, config) {
  const router = express.Router();

  // POST /api/profiles — create a buddy with a username + password. Creating
  // is only allowed for anonymous visitors; a logged-in user must log out
  // first (403). On success the creator is auto-logged-in via the cookie.
  router.post("/api/profiles", async (req, res, next) => {
    try {
      if (req.auth) {
        return res.status(403).json({ error: "Log out before creating a new buddy" });
      }
      const { username, avatarDef, password } = req.body || {};
      const result = await services.profile.create(username, avatarDef, password);
      const { auth } = services;
      auth.setSessionCookie(res, auth.signToken(result.username));
      res.status(201).json(result);
    } catch (err) {
      const status = toStatus(err.code);
      if (status) return res.status(status).json({ error: err.message });
      next(err);
    }
  });

  router.get("/api/profile/:username", requireAuthApi, (req, res, next) => {
    try {
      res.json(services.profile.get(req.params.username));
    } catch (err) {
      const status = toStatus(err.code);
      if (status) return res.status(status).json({ error: err.message });
      next(err);
    }
  });

  router.get("/api/profile/:username/public", requireAuthApi, (req, res, next) => {
    try {
      const profile = store.getPublicProfile(req.params.username);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      res.json(profile);
    } catch (err) {
      const status = toStatus(err.code);
      if (status) return res.status(status).json({ error: err.message });
      next(err);
    }
  });

  router.put("/api/profile/:username", requireOwner, async (req, res, next) => {
    try {
      const { avatarDef, mood } = req.body || {};
      const profile = await services.profile.update(req.params.username, avatarDef, mood);
      res.json(profile);
    } catch (err) {
      const status = toStatus(err.code);
      if (status) return res.status(status).json({ error: err.message });
      next(err);
    }
  });

  router.post("/api/profile/:username/interactions", requireAuthApi, async (req, res, next) => {
    try {
      const sender = req.auth.username;
      const profile = await services.interaction.add(req.params.username, req.body.type, sender);
      res.status(201).json({ profile });
    } catch (err) {
      const status = toStatus(err.code);
      if (status) return res.status(status).json({ error: err.message });
      next(err);
    }
  });

  return router;
}