import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  generateUsername,
  generateListenerUsername,
  usernameToEmail,
} from "@/lib/username";

type Role = "user" | "listener";

export async function POST(req: NextRequest) {
  let body: { password?: string; role?: Role };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const password = body.password?.trim();
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "密码至少需要 6 位" }, { status: 400 });
  }

  const role: Role = body.role === "listener" ? "listener" : "user";

  const admin = createServiceRoleClient();

  let username: string | null = null;
  let userId: string | null = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate =
      role === "listener" ? generateListenerUsername() : generateUsername();
    const email = usernameToEmail(candidate);

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("username", candidate)
      .maybeSingle();
    if (existing) continue;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      lastError = createError.message;
      // If the email is already taken (race), try a new username
      if (createError.message.toLowerCase().includes("already")) continue;
      return NextResponse.json({ error: "注册失败，请稍后再试" }, { status: 500 });
    }

    if (!created.user) {
      lastError = "user creation returned empty";
      continue;
    }

    const profileRow: {
      id: string;
      username: string;
      is_listener: boolean;
      listener_application_at?: string;
    } = {
      id: created.user.id,
      username: candidate,
      is_listener: false,
    };
    if (role === "listener") {
      profileRow.listener_application_at = new Date().toISOString();
    }

    const { error: profileError } = await admin.from("profiles").insert(profileRow);

    if (profileError) {
      // Roll back the auth user we just created so we can retry cleanly
      await admin.auth.admin.deleteUser(created.user.id);
      lastError = profileError.message;
      // Unique violation → retry with a new username
      if (profileError.code === "23505") continue;
      return NextResponse.json({ error: "注册失败，请稍后再试" }, { status: 500 });
    }

    username = candidate;
    userId = created.user.id;
    break;
  }

  if (!username || !userId) {
    return NextResponse.json(
      { error: lastError ?? "注册失败，请稍后再试" },
      { status: 500 }
    );
  }

  return NextResponse.json({ username, role });
}
