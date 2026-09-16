export function searchService(store) {
  return {
    search(query) {
      const q = typeof query === "string" ? query : "";
      return store.searchProfiles(q);
    }
  };
}