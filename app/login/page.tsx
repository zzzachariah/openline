"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import Logo from "@/components/Logo";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { createBrowserClient } from "@/lib/supabase/client";
import { usernameToEmail } from "@/lib/username";

function LoginContent() {
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
    try {
      const supabase = createBrowserClient();
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: usernameToEmail(u),
          password,
        });
      if (signInError || !signInData.user) {
        setError("用户名或密码不正确");
        setLoading(false);
        return;
      }

      // Determine where to send the user. Use the user we just signed in with
      // directly (avoid an extra getUser() roundtrip that can hang) and use
      // maybeSingle() so a missing profile row never blocks navigation.
      let target = "/me";
      if (redirect) {
        target = redirect;
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_listener, listener_application_at")
          .eq("id", signInData.user.id)
          .maybeSingle();
        if (profile?.is_listener) {
          target = "/listener";
        } else if (profile?.listener_application_at) {
          target = "/listener/pending";
        }
      }

      // Hard navigation guarantees the destination server component re-renders
      // with the auth cookies that signInWithPassword just set. router.push
      // can race with cookie propagation and leave the page in a stale state.
      window.location.assign(target);
    } catch {
      setError("登录失败，请稍后再试");
      setLoading(false);
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
                placeholder="用户名（如 匿名用户A3K9P2）"
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
