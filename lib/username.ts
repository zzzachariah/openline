// Excludes confusing chars: I, O, 0, 1
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateUsername(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return `匿名用户${suffix}`;
}

export function generateListenerUsername(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return `匿名倾听者${suffix}`;
}

export function usernameToEmail(username: string): string {
  // The email is just an internal handle for Supabase Auth — never shown.
  // Listeners get an `l_` prefix so a regular user and a listener can share the
  // same random suffix without colliding on the unique-email constraint.
  if (username.startsWith("匿名倾听者")) {
    const suffix = username.slice("匿名倾听者".length).toLowerCase();
    return `l_${suffix}@openline.local`;
  }
  const suffix = username.replace(/^匿名用户/, "").toLowerCase();
  return `${suffix}@openline.local`;
}
