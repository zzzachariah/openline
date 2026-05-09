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

// Returns every email format we should try for a typed username, in order.
// Lets a listener log in by typing only the 6-char suffix (e.g. "A3K9P2")
// instead of the full "匿名倾听者A3K9P2".
export function usernameToEmailCandidates(username: string): string[] {
  const trimmed = username.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("匿名倾听者")) {
    const suffix = trimmed.slice("匿名倾听者".length).toLowerCase();
    return [`l_${suffix}@openline.local`];
  }
  if (trimmed.startsWith("匿名用户")) {
    const suffix = trimmed.slice("匿名用户".length).toLowerCase();
    return [`${suffix}@openline.local`];
  }
  // Bare suffix — try regular user first, then listener.
  const suffix = trimmed.toLowerCase();
  return [`${suffix}@openline.local`, `l_${suffix}@openline.local`];
}
