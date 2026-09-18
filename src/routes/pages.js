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

  router.get("/register", (req, res) => {
    if (req.auth) {
      return res.redirect("/play");
    }
    res.render("register", services.pages.pageData("/register"));
  });

  router.get("/login", (req, res) => {
    if (req.auth) {
      return res.redirect("/play");
    }
    res.render("login", services.pages.pageData("/login"));
  });

  router.get("/play", requireAuth, (req, res) => {
    res.render("play", services.pages.playView(req.auth.username));
  });

  router.get("/embed/:username", (req, res) => {
    const data = services.pages.embedView(req.params.username);
    if (data.notFound) {
      res
        .status(404)
        .render("404", {
          username: data.username,
          pageTitle: "Not found | Buddy Clone",
          bodyClass: "page-embed embed-shell"
        });
      return;
    }
    res.render("embed", {
      profileJson: data.profileJson,
      pageTitle: data.pageTitle,
      bodyClass: data.bodyClass
    });
  });

  router.get("/create", (req, res) => {
    res.redirect(301, "/register");
  });

  router.get("/search", (req, res) => {
    res.redirect(301, "/");
  });

  router.get("/:username", (req, res) => {
    res.redirect(301, "/play");
  });

  return router;
}