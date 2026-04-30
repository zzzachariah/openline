"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Check, Copy } from "lucide-react";
import Logo from "@/components/Logo";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { createBrowserClient } from "@/lib/supabase/client";
import { usernameToEmail } from "@/lib/username";

function SignupContent() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") || "/me";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("密码至少需要 6 位");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "注册失败，请稍后再试");
        setLoading(false);
        return;
      }

      const username = data.username as string;
      // Sign in immediately so the session is set
      const supabase = createBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(username),
        password,
      });
      if (signInError) {
        setError("注册成功但登录失败，请前往登录页");
        setLoading(false);
        return;
      }
      setCreated(username);
      setLoading(false);
    } catch {
      setError("网络错误，请稍后再试");
      setLoading(false);
    }
  }

  async function copyUsername() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
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

          {!created ? (
            <div className="card">
              <h1 className="text-h2 font-medium tracking-tight text-center mb-2">注册</h1>
              <p className="text-caption text-muted text-center mb-7">
                我们不需要你的姓名、邮箱或电话。只需要设一个密码。
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pr-10"
                    placeholder="密码"
                    autoFocus
                    minLength={6}
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
                <input
                  type={show ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input"
                  placeholder="再次输入密码"
                  minLength={6}
                />
                {error && (
                  <div className="text-[14px] text-danger leading-relaxed">{error}</div>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? "注册中..." : "注册"}
                </button>
              </form>
              <p className="mt-6 text-caption text-muted text-center">
                已有账号？{" "}
                <Link href={`/login${redirect !== "/me" ? `?redirect=${redirect}` : ""}`} className="text-accent">
                  登录
                </Link>
              </p>
            </div>
          ) : (
            <div className="card text-center">
              <div className="flex justify-center mb-6">
                <div className="w-12 h-12 rounded-full bg-accent-soft flex items-center justify-center text-accent">
                  <Check size={20} />
                </div>
              </div>
              <h1 className="text-h2 font-medium tracking-tight mb-6">注册成功</h1>
              <p className="text-[15px] text-muted mb-3">你的用户名是</p>
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-accent bg-accent-soft mb-5">
                <span className="text-[16px] font-medium tracking-wide text-foreground">{created}</span>
                <button
                  onClick={copyUsername}
                  className="flex items-center gap-1 text-[14px] text-accent hover:opacity-80 transition-opacity"
                  aria-label="复制用户名"
                >
                  {copied ? (
                    <>
                      <Check size={14} />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      复制
                    </>
                  )}
                </button>
              </div>
              <p className="text-[15px] text-foreground/80 leading-relaxed mb-7">
                请保存这个用户名。
                <br />
                换设备登录时需要它。
              </p>
              <button
                onClick={() => router.push(redirect)}
                className="btn-primary w-full"
              >
                继续 →
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupContent />
    </Suspense>
  );
}
