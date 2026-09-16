import { normalizeUsername } from "../repository/store.js";
import { MAX_INTERACTION_TYPES, ValidationError } from "../repository/store.js";

export function interactionService(store) {
  return {
    add(username, type, sender) {
      const normalized = normalizeUsername(username);
      if (
        typeof type !== "string" ||
        type.length === 0 ||
        type.length > MAX_INTERACTION_TYPES
      ) {
        throw new ValidationError("Interaction type must be a non-empty short string");
      }
      const senderName = normalizeUsername(sender || "");
      if (senderName && senderName === normalized) {
        throw new ValidationError("You cannot poke your own buddy");
      }
      return store.addInteraction(normalized, type, sender);
    }
  };
}