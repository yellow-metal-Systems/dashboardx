// Names for the links in a demo email, from the link's path only, so they stay
// right whatever host LeadBridge moves to (localhost today, a real domain later).

const NAMES: [RegExp, string][] = [
  [/^\/invite\//, "Set-password link"],
  [/^\/agreement\//, "Signing link"],
  [/^\/install\/?$/, "Add-to-home-screen page"],
];

/** "Signing link" for /agreement/…, and so on; "Link" for anything else. */
export function linkName(href: string): string {
  const path = pathOf(href);
  return NAMES.find(([re]) => re.test(path))?.[1] ?? "Link";
}

/** The path, with long tokens shortened: "/invite/45vo5J…3d8M". */
export function shortPath(href: string): string {
  return pathOf(href)
    .split("/")
    .map((part) => (part.length > 16 ? `${part.slice(0, 6)}…${part.slice(-4)}` : part))
    .join("/");
}

function pathOf(href: string): string {
  try {
    return new URL(href).pathname;
  } catch {
    return href;
  }
}
