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
  "/register": {
    view: "register",
    pageTitle: "Register | Buddy Clone",
    bodyClass: "page-register"
  },
  "/login": {
    view: "login",
    pageTitle: "Log in | Buddy Clone",
    bodyClass: "page-login"
  }
};

export function pageService(store) {
  return {
    pageData(route) {
      return PAGES[route];
    },

    playView(username) {
      const profile = store.getProfile(username);
      if (!profile) {
        return { notFound: true };
      }
      return {
        notFound: false,
        profile,
        profileJson: inlineJson(profile),
        pageTitle: "Play | Buddy Clone",
        bodyClass: "page-play"
      };
    },

    embedView(username) {
      const name = normalizeUsername(username);
      const profile = store.getPublicProfile(name);
      if (!profile) {
        return { notFound: true, username: name };
      }
      const publicProfile = {
        username: profile.username,
        avatarDef: profile.avatarDef,
        mood: profile.mood
      };
      return {
        notFound: false,
        profile: publicProfile,
        profileJson: inlineJson(publicProfile),
        pageTitle: "Buddy widget",
        bodyClass: "page-embed embed-shell"
      };
    }
  };
}