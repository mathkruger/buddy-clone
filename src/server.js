import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "./repository/store.js";
import { securityHeaders } from "./middleware/security-headers.js";
import { attachUser } from "./middleware/auth.js";
import { authService } from "./services/auth-service.js";
import { profileService } from "./services/profile-service.js";
import { interactionService } from "./services/interaction-service.js";
import { favoritesService } from "./services/favorites-service.js";
import { pageService } from "./services/page-service.js";
import { authRouter } from "./routes/auth.js";
import { profilesRouter } from "./routes/profiles.js";
import { favoritesRouter } from "./routes/favorites.js";
import { pagesRouter } from "./routes/pages.js";

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(SRC_DIR, "..", "data.db");
const DATA_FILE = process.env.DATA_FILE || path.join(SRC_DIR, "..", "data.json");
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || "sqlite";
const PUBLIC_DIR = path.join(SRC_DIR, "public");
const NODE_MODULES_DIR = path.join(SRC_DIR, "..", "node_modules");

const DEV_JWT_SECRET = "buddy-clone-development-secret-change-before-deploying";
const DEFAULT_JWT_EXPIRES = "7d";
export const AUTH_COOKIE = "buddy_token";

export function authConfig() {
  const secret = process.env.JWT_SECRET || DEV_JWT_SECRET;
  if (!process.env.JWT_SECRET) {
    console.warn(
      "WARNING: JWT_SECRET is not set — using an insecure development fallback. Set JWT_SECRET in production."
    );
  }
  return {
    cookieName: AUTH_COOKIE,
    secret,
    expires: process.env.JWT_EXPIRES || DEFAULT_JWT_EXPIRES,
    cookieSecure: process.env.NODE_ENV === "production"
  };
}

export function createApp(store) {
  const config = authConfig();
  const auth = authService(store, config);
  const services = {
    auth,
    profile: profileService(store, auth),
    interaction: interactionService(store),
    favorites: favoritesService(store),
    pages: pageService(store)
  };

  const app = express();
  app.set("views", path.join(SRC_DIR, "views"));
  app.set("view engine", "ejs");
  app.use(securityHeaders());
  app.use(express.json({ limit: "64kb" }));
  app.use(attachUser(config));

  app.use(authRouter(store, services, config));
  app.use(profilesRouter(store, services, config));
  app.use(favoritesRouter(store, services));

  // Whitelisted vendored WebGL library assets — served from the app's own
  // static paths so rendering never depends on an external CDN, and the
  // FBXLoader's relative imports (`../libs/`, `../curves/`) resolve from the
  // same origin.
  app.use("/vendor/three", express.static(path.join(NODE_MODULES_DIR, "three", "build")));
  app.use("/vendor/three-examples", express.static(path.join(NODE_MODULES_DIR, "three", "examples", "jsm")));

  app.use(express.static(PUBLIC_DIR));

  // The vendored buddylabs manifests encode absolute `/assets/buddylabs/...`
  // paths (the source site's layout); alias the same files there so the
  // ported builders resolve them without rewriting the manifest JSON.
  app.use("/assets/buddylabs", express.static(path.join(PUBLIC_DIR, "buddylabs")));

  app.use(pagesRouter(store, services));

  return app;
}

if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  const store = new Store({
    path: DB_PATH,
    dataFile: DATA_FILE,
    provider: STORAGE_PROVIDER
  });
  const app = createApp(store);
  store.init().then(() => {
    app.listen(PORT, () => {
      console.log(`buddy-clone listening on http://localhost:${PORT}`);
    });
  });
}