import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { normalizeUsername } from "../repository/store.js";

const BCRYPT_ROUNDS = 12;

// Password hash / verifier, JWT signer/verifier, and HttpOnly session cookie
// helpers. `login` performs the full username+password → JWT → cookie flow and
// returns whether the credentials were accepted; unknown usernames and wrong
// passwords both come back false so the route can answer a generic 401.
export function authService(store, config) {
  function getPasswordHash(username) {
    return store.getPasswordHash(normalizeUsername(username));
  }

  async function hashPassword(password) {
    return bcrypt.hash(String(password), BCRYPT_ROUNDS);
  }

  async function verifyPassword(password, hash) {
    if (typeof hash !== "string" || hash.length === 0) return false;
    try {
      return await bcrypt.compare(String(password), hash);
    } catch {
      return false;
    }
  }

  function signToken(username) {
    return jwt.sign({ sub: normalizeUsername(username) }, config.secret, {
      expiresIn: config.expires
    });
  }

  function verifyToken(token) {
    return jwt.verify(token, config.secret);
  }

  function setSessionCookie(res, token) {
    res.cookie(config.cookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.cookieSecure,
      path: "/"
    });
  }

  function clearSessionCookie(res) {
    res.clearCookie(config.cookieName, { path: "/" });
  }

  function login(req, res, username, password) {
    return (async () => {
      const hash = getPasswordHash(username);
      const ok = await verifyPassword(password, hash);
      if (!ok) return false;
      setSessionCookie(res, signToken(username));
      return true;
    })();
  }

  return {
    hashPassword,
    verifyPassword,
    signToken,
    verifyToken,
    setSessionCookie,
    clearSessionCookie,
    login
  };
}