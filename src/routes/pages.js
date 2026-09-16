import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuth } from "../middleware/auth.js";

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(SRC_DIR, "..", "public");

export function pagesRouter(store, services) {
  const router = express.Router();

  router.use(express.static(PUBLIC_DIR));

  router.get("/", (req, res) => {
    res.render("index", services.pages.pageData("/"));
  });

  router.get("/create", (req, res) => {
    res.render("create", {
      ...services.pages.pageData("/create"),
      viewer: req.auth ? req.auth.username : null
    });
  });

  router.get("/login", (req, res) => {
    if (req.auth) {
      return res.redirect(`/${encodeURIComponent(req.auth.username)}`);
    }
    res.render("login", services.pages.pageData("/login"));
  });

  router.get("/search", requireAuth, (req, res) => {
    res.render("search", services.pages.pageData("/search"));
  });

  router.get("/favorites", requireAuth, (req, res) => {
    res.render("favorites", services.pages.pageData("/favorites"));
  });

  router.get("/embed/:username", (req, res) => {
    const data = services.pages.embedView(req.params.username);
    if (data.notFound) {
      res
        .status(404)
        .render("404", { username: data.username, pageTitle: data.pageTitle, bodyClass: data.bodyClass });
      return;
    }
    res.render("embed", {
      profileJson: data.profileJson,
      pageTitle: data.pageTitle,
      bodyClass: data.bodyClass
    });
  });

  router.get("/:username", requireAuth, (req, res) => {
    const data = services.pages.profileView(req.params.username);
    if (data.notFound) {
      res
        .status(404)
        .render("404", { username: data.username, pageTitle: data.pageTitle, bodyClass: data.bodyClass });
      return;
    }
    res.render("profile", {
      profileJson: data.profileJson,
      pageTitle: data.pageTitle,
      bodyClass: data.bodyClass
    });
  });

  return router;
}