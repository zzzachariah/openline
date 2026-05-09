import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  generateUsername,
  generateListenerUsername,
  usernameToEmail,
} from "@/lib/username";

type Role = "user" | "listener";

const isDev = process.env.NODE_ENV !== "production";

function fail(message: string, status: number, detail?: string) {
  if (detail) console.error(`[signup] ${message} — ${detail}`);
  return NextResponse.json(
    { error: message, ...(isDev && detail ? { detail } : {}) },
    { status }
  );
}

export async function POST(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return fail(
      "服务器未配置 Supabase 环境变量（NEXT_PUBLIC_SUPABASE_URL 缺失）",
      500
    );
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail(
      "服务器未配置 Supabase 环境变量（SUPABASE_SERVICE_ROLE_KEY 缺失）",
      500
    );
  }

  let body: { password?: string; role?: Role };
  try {
    body = await req.json();
  } catch {
    return fail("请求格式错误", 400);
  }

  const password = body.password?.trim();
  if (!password || password.length < 6) {
    return fail("密码至少需要 6 位", 400);
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

    const { data: existing, error: existingErr } = await admin
      .from("profiles")
      .select("id")
      .eq("username", candidate)
      .maybeSingle();
    if (existingErr) {
      console.error("[signup] profile lookup failed:", existingErr);
      lastError = existingErr.message;
      return fail("注册失败：数据库查询出错", 500, existingErr.message);
    }
    if (existing) continue;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      console.error(
        `[signup] createUser failed (attempt ${attempt + 1}):`,
        createError
      );
      lastError = createError.message;
      const msg = createError.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) continue;
      return fail("注册失败，请稍后再试", 500, createError.message);
    }

    if (!created.user) {
      lastError = "user creation returned empty";
      console.error("[signup] createUser returned empty user");
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
      console.error(
        `[signup] profile insert failed (attempt ${attempt + 1}):`,
        profileError
      );
      // Roll back the auth user we just created so we can retry cleanly
      await admin.auth.admin.deleteUser(created.user.id);
      lastError = profileError.message;
      // Unique violation → retry with a new username
      if (profileError.code === "23505") continue;
      return fail("注册失败，请稍后再试", 500, profileError.message);
    }

    username = candidate;
    userId = created.user.id;
    break;
  }

  if (!username || !userId) {
    return fail("注册失败，请稍后再试", 500, lastError ?? "exhausted retries");
  }

  return NextResponse.json({ username, role });
}
