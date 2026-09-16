import { normalizeUsername } from "../repository/store.js";
import { ValidationError } from "../repository/store.js";

export function favoritesService(store) {
  return {
    async list(username) {
      return store.getFavorites(normalizeUsername(username));
    },

    async add(username, target) {
      const normalized = normalizeUsername(username);
      if (typeof target !== "string" || target.length === 0) {
        throw new ValidationError("Missing target");
      }
      return store.addFavorite(normalized, target);
    },

    async remove(username, target) {
      const normalized = normalizeUsername(username);
      if (typeof target !== "string" || target.length === 0) {
        throw new ValidationError("Missing target");
      }
      return store.removeFavorite(normalized, target);
    }
  };
}