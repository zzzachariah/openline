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
  // Strip the prefix (匿名用户 or 匿名倾听者) and lowercase the suffix.
  // The email is just an internal handle for Supabase Auth — never shown.
  const suffix = username.replace(/^匿名用户/, "").replace(/^匿名倾听者/, "").toLowerCase();
  return `${suffix}@openline.local`;
}
