import express from "express";
import { requireOwner } from "../middleware/auth.js";

function toStatus(code) {
  switch (code) {
    case "ValidationError":
      return 400;
    case "NotFoundError":
      return 404;
    default:
      return undefined;
  }
}

export function favoritesRouter(store, services) {
  const router = express.Router();

  router.get("/api/profile/:username/favorites", requireOwner, async (req, res, next) => {
    try {
      const favorites = await services.favorites.list(req.params.username);
      res.json({ favorites });
    } catch (err) {
      const status = toStatus(err.code);
      if (status) return res.status(status).json({ error: err.message });
      next(err);
    }
  });

  router.put("/api/profile/:username/favorites", requireOwner, async (req, res, next) => {
    try {
      const { target } = req.body || {};
      const favorites = await services.favorites.add(req.params.username, target);
      res.json({ favorites });
    } catch (err) {
      const status = toStatus(err.code);
      if (status) return res.status(status).json({ error: err.message });
      next(err);
    }
  });

  router.delete("/api/profile/:username/favorites", requireOwner, async (req, res, next) => {
    try {
      const { target } = req.body || {};
      const favorites = await services.favorites.remove(req.params.username, target);
      res.json({ favorites });
    } catch (err) {
      const status = toStatus(err.code);
      if (status) return res.status(status).json({ error: err.message });
      next(err);
    }
  });

  return router;
}