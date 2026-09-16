export function securityHeaders() {
  return (req, res, next) => {
    const isEmbed = req.path === "/embed" || req.path.startsWith("/embed/");
    const frameAncestors = isEmbed ? "*" : "'self'";
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors ${frameAncestors}`
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  };
}