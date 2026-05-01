"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import Logo from "@/components/Logo";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { createBrowserClient } from "@/lib/supabase/client";
import { usernameToEmail } from "@/lib/username";
import { TimeoutError, withTimeout } from "@/lib/with-timeout";

const LOGIN_TIMEOUT_MS = 10_000;

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const u = username.trim();
    if (!u || !password) {
      setError("请填写用户名和密码");
      return;
    }
    setLoading(true);
    let target: string | null = null;
    try {
      const supabase = createBrowserClient();
      const { error: signInError } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: usernameToEmail(u),
          password,
        }),
        LOGIN_TIMEOUT_MS,
        "登录超时（10 秒未响应），请检查网络后重试"
      );
      if (signInError) {
        const msg = signInError.message?.toLowerCase() ?? "";
        if (msg.includes("invalid login")) {
          setError("用户名或密码不正确");
        } else if (msg.includes("rate limit")) {
          setError("尝试次数过多，请稍后再试");
        } else if (msg.includes("network") || msg.includes("fetch")) {
          setError("网络连接失败，请检查网络后重试");
        } else {
          setError(`登录失败：${signInError.message}`);
        }
        return;
      }

      const { data: auth, error: userError } = await withTimeout(
        supabase.auth.getUser(),
        LOGIN_TIMEOUT_MS,
        "登录后获取用户信息超时，请重试"
      );
      if (userError || !auth.user) {
        setError("登录后无法获取用户信息，请重试");
        return;
      }

      const { data: profile, error: profileError } = await withTimeout(
        supabase
          .from("profiles")
          .select("is_listener, listener_application_at")
          .eq("id", auth.user.id)
          .single(),
        LOGIN_TIMEOUT_MS,
        "读取用户信息超时，请重试"
      );
      if (profileError) {
        setError(`无法读取账号信息：${profileError.message}`);
        return;
      }

      if (redirect) {
        target = redirect;
      } else if (profile?.is_listener) {
        target = "/listener";
      } else if (profile?.listener_application_at) {
        target = "/listener/pending";
      } else {
        target = "/me";
      }
    } catch (err) {
      if (err instanceof TimeoutError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(`登录失败：${err.message}`);
      } else {
        setError("登录失败，请稍后再试");
      }
    } finally {
      setLoading(false);
    }
    if (target) {
      router.replace(target);
      router.refresh();
    }
  }

  return (
    <>
      <Nav />
      <main className="pt-24 pb-16 min-h-screen">
        <div className="max-w-[400px] mx-auto px-6">
          <div className="flex justify-center mb-8">
            <Logo size={40} className="text-accent" />
          </div>
          <div className="card">
            <h1 className="text-h2 font-medium tracking-tight text-center mb-2">登录</h1>
            <p className="text-caption text-muted text-center mb-7">
              输入你保存的用户名和密码。
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="用户名（如 匿名用户A3K9P2 或 匿名倾听者A3K9P2）"
                autoFocus
                autoComplete="username"
              />
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="密码"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                  aria-label={show ? "隐藏密码" : "显示密码"}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && (
                <div className="text-[14px] text-danger leading-relaxed">{error}</div>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "登录中..." : "登录"}
              </button>
            </form>
            <p className="mt-6 text-caption text-muted text-center">
              还没有账号？{" "}
              <Link
                href={`/signup${redirect ? `?redirect=${redirect}` : ""}`}
                className="text-accent"
              >
                注册
              </Link>
            </p>
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-caption text-muted text-center">
                想成为倾听者？{" "}
                <Link href="/listener/signup" className="text-accent">
                  申请加入
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
