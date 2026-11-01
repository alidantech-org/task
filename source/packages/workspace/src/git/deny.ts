const deniedDirectories = new Set([".git", "node_modules", ".ssh", ".gnupg", ".aws"]);
const deniedNames = [
  /^\.env($|\.)/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.|$)/i,
  /^\.npmrc$/i,
  /^\.netrc$/i,
  /^\.pgpass$/i,
  /^credentials(\.|$)/i,
  /^secrets?(\.|$)/i,
];
const deniedExtensions = [".pem", ".key", ".p12", ".pfx", ".jks", ".keystore", ".kdbx"];

/**
 * Whether a project-relative path may be shown to the dashboard or other clients. Applies to file
 * contents and diff contents; denied paths may still be listed by name.
 */
export function isDeniedPath(relativePath: string): boolean {
  const segments = relativePath.split(/[\\/]/).filter(Boolean);
  if (segments.length === 0) return true;
  if (segments.some((segment) => deniedDirectories.has(segment))) return true;
  const name = segments[segments.length - 1] ?? "";
  const lower = name.toLowerCase();
  return (
    deniedNames.some((pattern) => pattern.test(name)) ||
    deniedExtensions.some((extension) => lower.endsWith(extension))
  );
}
