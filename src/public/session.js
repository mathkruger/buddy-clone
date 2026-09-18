// Shared session helper — "who am I now", backed by the server.
//
// The browser no longer holds claim tokens: session state comes from
// `GET /api/auth/me` (the HttpOnly `buddy_token` cookie travels with the
// request automatically) and logout calls `POST /api/auth/logout`. Legacy
// `buddy.token.*` / `buddy.currentUser` localStorage keys are no longer used.

let currentUsername = null;
let sessionReady;

function normalizeUsername(name) {
  return String(name).trim().toLowerCase();
}

async function fetchSession() {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    const data = await res.json();
    if (data && data.user && typeof data.user.username === "string") {
      return normalizeUsername(data.user.username);
    }
    return null;
  } catch {
    return null;
  }
}

async function refresh() {
  currentUsername = await fetchSession();
  window.dispatchEvent(new CustomEvent("buddy:session", { detail: { username: currentUsername } }));
  return currentUsername;
}

sessionReady = refresh();

export const BuddySession = {
  get currentUser() {
    return currentUsername;
  },

  isLoggedIn() {
    return Boolean(currentUsername);
  },

  // Resolves once the session has been fetched from the server. Modules that
  // depend on login state should `await BuddySession.ready()` before reading.
  ready() {
    return sessionReady;
  },

  async logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // Server unreachable — drop the local session state anyway.
    }
    currentUsername = null;
    initNav();
    window.dispatchEvent(new CustomEvent("buddy:logout"));
  }
};

// Wire the `#nav-auth` slot in the site header: a login + register link for
// guests, or a "Play" link and "Log out" button for the active owner.
export function initNav() {
  const slot = document.getElementById("nav-auth");
  if (!slot) return;
  slot.textContent = "";

  const username = currentUsername;

  if (username) {
    const play = document.createElement("a");
    play.className = "nav-my-buddy";
    play.href = "/play";
    play.textContent = "Play";

    const logout = document.createElement("button");
    logout.type = "button";
    logout.className = "nav-logout";
    logout.textContent = "Log out";
    logout.addEventListener("click", () => {
      BuddySession.logout().then(initNav);
    });

    slot.append(play, " ", logout);
  } else {
    const login = document.createElement("a");
    login.href = "/login";
    login.textContent = "Login";

    const register = document.createElement("a");
    register.href = "/register";
    register.textContent = "Register";

    slot.append(login, " ", register);
  }
}

window.BuddySession = BuddySession;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNav);
} else {
  initNav();
}
sessionReady.then(initNav);