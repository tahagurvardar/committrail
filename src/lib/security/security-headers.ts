export const SECURITY_HEADER_NAMES = [
  "Content-Security-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
  "Permissions-Policy",
  "Referrer-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
] as const;

export function buildContentSecurityPolicy(input: {
  nonce: string;
  production: boolean;
}): string {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${input.nonce}'${
      input.production ? " 'strict-dynamic'" : " 'unsafe-eval'"
    }`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://avatars.githubusercontent.com",
    "font-src 'self'",
    `connect-src 'self'${input.production ? "" : " ws:"}`,
    "manifest-src 'self'",
    "worker-src 'self' blob:",
  ];
  if (input.production) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function applySecurityHeaders(
  headers: Headers,
  input: {
    nonce: string;
    production: boolean;
    https: boolean;
  },
): void {
  headers.set("Content-Security-Policy", buildContentSecurityPolicy(input));
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  );
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  if (input.production && input.https)
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
}
