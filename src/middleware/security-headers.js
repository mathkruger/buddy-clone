export function securityHeaders() {
  return (req, res, next) => {
    const isEmbed = req.path === "/embed" || req.path.startsWith("/embed/");
    const frameAncestors = isEmbed ? "*" : "'self'";
    // The inline import map in partials/head.ejs is static metadata, not
    // executable code; a content hash lets it through while keeping the strict
    // `script-src 'self'` policy for everything else.
    const importMapHash = "'sha256-eYbnetMnAqgrNo0XAshDw2joI8IlZTpviTHBqWsVtRo='";
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self' ${importMapHash}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors ${frameAncestors}`
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  };
}