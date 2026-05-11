"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Check, Copy } from "lucide-react";
import Logo from "@/components/Logo";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { createBrowserClient } from "@/lib/supabase/client";
import { usernameToEmail } from "@/lib/username";
import { TimeoutError, withTimeout } from "@/lib/with-timeout";

const SIGNUP_TIMEOUT_MS = 15_000;

function ListenerSignupContent() {
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
      const res = await withTimeout(
        fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password, role: "listener" }),
        }),
        SIGNUP_TIMEOUT_MS,
        "注册超时（15 秒未响应），请检查网络后重试"
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || `注册失败（${res.status}），请稍后再试`);
        return;
      }

      const username = data?.username as string | undefined;
      if (!username) {
        setError("注册返回数据异常，请稍后再试");
        return;
      }

      // Sign in immediately so the listener lands on the pending page.
      const supabase = createBrowserClient();
      const { error: signInError } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: usernameToEmail(username),
          password,
        }),
        SIGNUP_TIMEOUT_MS,
        "注册成功但登录超时，请前往登录页用此用户名登录"
      );
      if (signInError) {
        // Account exists but sign-in failed; still show the username so they
        // can log in manually after.
        setCreated(username);
        return;
      }
      setCreated(username);
    } catch (err) {
      if (err instanceof TimeoutError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(`注册失败：${err.message}`);
      } else {
        setError("网络错误，请稍后再试");
      }
    } finally {
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
              <h1 className="text-h2 font-medium tracking-tight text-center mb-2">
                成为倾听者
              </h1>
              <p className="text-caption text-muted text-center mb-7 leading-relaxed">
                我们不需要你的姓名、邮箱或电话。
                <br />
                注册后我们会人工审核你的申请。
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
                  {loading ? "提交中..." : "提交申请"}
                </button>
              </form>
              <p className="mt-6 text-caption text-muted text-center">
                普通用户？{" "}
                <Link href="/signup" className="text-accent">
                  注册
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
              <h1 className="text-h2 font-medium tracking-tight mb-3">申请已提交</h1>
              <p className="text-[15px] text-muted mb-6 leading-relaxed">
                我们会尽快审核你的申请。
                <br />
                请保存下面的用户名——它是你以后登录的凭证。
              </p>
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-accent bg-accent-soft mb-7">
                <span className="text-[16px] font-medium tracking-wide text-foreground">
                  {created}
                </span>
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
              <button
                onClick={() => window.location.assign("/listener/pending")}
                className="btn-primary w-full"
              >
                查看审核状态 →
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

export default function ListenerSignupPage() {
  return (
    <Suspense fallback={null}>
      <ListenerSignupContent />
    </Suspense>
  );
}
