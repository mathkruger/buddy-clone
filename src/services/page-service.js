import { normalizeUsername } from "../repository/store.js";

// JSON embedded into <script> is made safe against `</script><script>`
// breakout by escaping angle brackets.
export function inlineJson(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

const PAGES = {
  "/": {
    view: "index",
    pageTitle: "Buddy Clone — make a buddy, pop a mood, get poked",
    bodyClass: "page-home"
  },
  "/create": {
    view: "create",
    pageTitle: "Buddy Clone — make your buddy",
    bodyClass: "page-create"
  },
  "/login": {
    view: "login",
    pageTitle: "Log in | Buddy Clone",
    bodyClass: "page-login"
  },
  "/search": {
    view: "search",
    pageTitle: "Search buddies | Buddy Clone",
    bodyClass: "page-search"
  },
  "/favorites": {
    view: "favorites",
    pageTitle: "My favorites | Buddy Clone",
    bodyClass: "page-favorites"
  }
};

export function pageService(store) {
  function lookup(username) {
    const normalized = normalizeUsername(username);
    const profile = store.getProfile(normalized);
    if (!profile) {
      return {
        notFound: true,
        username: normalized,
        pageTitle: "Not found | Buddy Clone",
        bodyClass: "page-profile"
      };
    }
    return { notFound: false, profile };
  }

  return {
    pageData(route) {
      return PAGES[route];
    },

    profileView(username) {
      const found = lookup(username);
      if (found.notFound) return found;
      return {
        notFound: false,
        profile: found.profile,
        profileJson: inlineJson(found.profile),
        pageTitle: "Buddy and friends",
        bodyClass: "page-profile"
      };
    },

    embedView(username) {
      const found = lookup(username);
      if (found.notFound) return found;
      return {
        notFound: false,
        profile: found.profile,
        profileJson: inlineJson(found.profile),
        pageTitle: "Buddy widget",
        bodyClass: "page-embed embed-shell"
      };
    }
  };
}