"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check } from "lucide-react";
import Logo from "@/components/Logo";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { createBrowserClient } from "@/lib/supabase/client";

export default function ListenerPendingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login?redirect=/listener/pending");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, is_listener, listener_application_at")
        .eq("id", auth.user.id)
        .single();
      if (!profile) return;
      if (cancelled) return;

      // Already approved — go to the listener dashboard.
      if (profile.is_listener) {
        router.push("/listener");
        return;
      }
      // Never applied — they're a regular user.
      if (!profile.listener_application_at) {
        router.push("/me");
        return;
      }
      setUsername(profile.username);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function copyUsername() {
    if (!username) return;
    try {
      await navigator.clipboard.writeText(username);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function logout() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <Nav />
      <main className="pt-24 pb-16 min-h-screen">
        <div className="max-w-[440px] mx-auto px-6">
          <div className="flex justify-center mb-8">
            <Logo size={40} className="text-accent" />
          </div>
          {loading ? (
            <div className="text-muted text-center py-12">载入中...</div>
          ) : (
            <div className="card text-center">
              <h1 className="text-h2 font-medium tracking-tight mb-3">审核中</h1>
              <p className="text-[15px] text-muted leading-relaxed mb-7">
                你的倾听者申请已经提交。
                <br />
                我们会尽快审核——通过后再回来登录就可以开始倾听。
              </p>
              {username && (
                <>
                  <p className="text-caption text-muted mb-2">你的用户名</p>
                  <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-border bg-accent-soft mb-7">
                    <span className="text-[15px] font-medium tracking-wide text-foreground">
                      {username}
                    </span>
                    <button
                      onClick={copyUsername}
                      className="flex items-center gap-1 text-[13px] text-accent hover:opacity-80 transition-opacity"
                      aria-label="复制用户名"
                    >
                      {copied ? (
                        <>
                          <Check size={12} />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          复制
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
              <button onClick={logout} className="btn-secondary w-full">
                退出登录
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
