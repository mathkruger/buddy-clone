import express from "express";
import { requireAuthApi } from "../middleware/auth.js";

export function searchRouter(store, services) {
  const router = express.Router();

  router.get("/api/search", requireAuthApi, (req, res) => {
    const results = services.search.search(req.query.q);
    res.json({ results });
  });

  return router;
}