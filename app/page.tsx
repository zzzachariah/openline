"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import Slide from "@/components/Slide";
import Counter from "@/components/Counter";
import SlideIndicator from "@/components/SlideIndicator";
import Nav from "@/components/Nav";
import { useTheme } from "@/components/ThemeProvider";
import { Sun, Moon } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";

const SLIDE_COUNT = 10;

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const [bookingTotal, setBookingTotal] = useState<number | null>(null);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createBrowserClient();
        const { data } = await supabase
          .from("stats")
          .select("value")
          .eq("id", "total_bookings")
          .single();
        if (!cancelled) setBookingTotal(data?.value ?? 0);
      } catch {
        if (!cancelled) setBookingTotal(0);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSlideRef = (i: number) => (el: HTMLElement | null) => {
    slideRefs.current[i] = el;
  };

  const scrollToSlide = (i: number) => {
    const node = slideRefs.current[i];
    if (node) node.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <Nav transparentOnTop />
      <SlideIndicator count={SLIDE_COUNT} onJump={scrollToSlide} />
      <div ref={containerRef} className="snap-container">
        {/* Slide 1 — Hero */}
        <Slide
          ref={setSlideRef(0)}
          ariaLabel="第一屏"
          hasChevron
          onChevronClick={() => scrollToSlide(1)}
        >
          <div className="text-center">
            <div className="flex justify-center mb-12 fade-up">
              <Logo size={80} className="text-accent" />
            </div>
            <div className="space-y-5 text-body-lg text-foreground/90">
              <p className="fade-up fade-up-delay-1">也许你最近感觉很疲惫，但又说不上是哪里。</p>
              <p className="fade-up fade-up-delay-2">也许只是憋了太久，没人可以讲。</p>
              <p className="fade-up fade-up-delay-3">
                你可能想过&ldquo;是不是该去看看了&rdquo;，
                <br />
                但又不确定自己是不是有问题，
                <br />
                或者哪里出了问题。
              </p>
              <p className="fade-up fade-up-delay-4">
                你也可能担心，如果告诉家长或者老师，
                <br />
                会不会对你的学习、生活带来更多影响。
              </p>
            </div>
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3 fade-up fade-up-delay-5">
              <Link href="/book" className="btn-primary">预约一次倾诉</Link>
              <button onClick={() => scrollToSlide(1)} className="btn-ghost">
                了解更多 ↓
              </button>
            </div>
            <p className="mt-12 text-caption text-muted fade-up fade-up-delay-6">
              {bookingTotal !== null ? (
                <>
                  已陪伴 <Counter target={bookingTotal} /> 次倾诉
                </>
              ) : (
                <span className="opacity-0">已陪伴 0 次倾诉</span>
              )}
            </p>
          </div>
        </Slide>

        {/* Slide 2 — 我们是谁 */}
        <Slide
          ref={setSlideRef(1)}
          ariaLabel="我们是谁"
          hasChevron
          onChevronClick={() => scrollToSlide(2)}
        >
          <div className="space-y-7 text-body-lg">
            <p className="fade-up">
              我们不是医生，也不是专业的心理咨询师。
              <br />
              我们不会假装是。
            </p>
            <p className="fade-up fade-up-delay-1">
              甚至可以说，
              <br />
              我们可能也面临过，
              <br />
              或者正在面临和你类似的问题。
            </p>
            <p className="fade-up fade-up-delay-2">不过，我们是一群愿意认真听你说话的人。</p>
            <p className="fade-up fade-up-delay-3">
              聊一聊，让我们一起看看
              <br />
              你的疲惫和不安是不是只是需要一个可以说出来的地方；
              <br />
              还是一个需要被认真对待的信号——
            </p>
            <p className="fade-up fade-up-delay-4">不管是哪种，你都不用一个人扛着。</p>
          </div>
        </Slide>

        {/* Slide 3 — 关于隐私的承诺（短版） */}
        <Slide
          ref={setSlideRef(2)}
          ariaLabel="隐私承诺"
          hasChevron
          onChevronClick={() => scrollToSlide(3)}
        >
          <div className="text-center space-y-8 text-body-lg max-w-md mx-auto">
            <p className="fade-up">我们会保护你的隐私。</p>
            <p className="fade-up fade-up-delay-2 text-foreground/90">
              我们不认识你，
              <br />
              也不需要你提供任何关于真实姓名、地区、
              <br />
              学校甚至性别的信息。
            </p>
            <p className="fade-up fade-up-delay-4">你可以只做你自己。</p>
          </div>
        </Slide>

        {/* Slide 4 — 这里能帮到你什么 */}
        <Slide
          ref={setSlideRef(3)}
          ariaLabel="这里能帮到你什么"
          hasChevron
          onChevronClick={() => scrollToSlide(4)}
        >
          <div className="space-y-7 text-body-lg">
            <p className="fade-up">
              跟一个陌生人说出来，
              <br />
              哪怕对方无法替你解决问题，
              <br />
              也常常会让事情变得没那么重。
            </p>
            <p className="fade-up fade-up-delay-1">
              心理学中的&ldquo;命名情绪&rdquo;定理就能很好地诠释我们的目的——
              <br />
              把感受讲出来，本就能让大脑里负责焦虑的部分安静下来。
            </p>
            <div className="flex justify-center fade-up fade-up-delay-2">
              <span className="block w-10 h-px bg-accent" aria-hidden="true" />
            </div>
            <p className="fade-up fade-up-delay-3">但我们也想坦白：</p>
            <p className="fade-up fade-up-delay-4">
              聊天可以帮你缓一口气，帮你理清一点点，
              <br />
              也能让你没那么孤单。
            </p>
            <p className="fade-up fade-up-delay-5">
              但聊天 <span className="text-accent">不能</span> 代替专业帮助，
              <br />
              也 <span className="text-accent">不能</span> 处理危险情况。
            </p>
            <p className="fade-up fade-up-delay-6">
              如果你的情况需要更专业的支持，
              <br />
              我们会直接告诉你，
              <br />
              并尽力帮你看清下一步可以怎么走。
            </p>
            <p className="fade-up fade-up-delay-6 text-muted">
              我们不隶属于任何机构，
              <br />
              也不会把你引导到特定的咨询渠道。
            </p>
          </div>
        </Slide>

        {/* Slide 5 — 怎么用 */}
        <Slide
          ref={setSlideRef(4)}
          ariaLabel="怎么用"
          hasChevron
          onChevronClick={() => scrollToSlide(5)}
        >
          <div className="w-full">
            <h2 className="text-h2 md:text-h2 font-medium tracking-tight mb-12 fade-up">怎么用</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 fade-up fade-up-delay-1">
              {[
                { n: "01", title: "选择时间", body: "挑一个你方便的时段" },
                { n: "02", title: "选择形式", body: "文字聊天，或语音" },
                { n: "03", title: "一次 40 分钟", body: "时间到我们会提醒\n但不会直接打断" },
                { n: "04", title: "全程匿名", body: "不需要任何真实信息" },
              ].map((c) => (
                <div key={c.n} className="card border-accent/30">
                  <div className="text-[32px] font-medium text-accent mb-4">{c.n}</div>
                  <div className="text-[17px] font-medium mb-2">{c.title}</div>
                  <div className="text-[14px] text-muted whitespace-pre-line leading-relaxed">{c.body}</div>
                </div>
              ))}
            </div>
            <p className="mt-10 text-[15px] text-muted leading-relaxed fade-up fade-up-delay-2">
              如果结束后你感觉并不&ldquo;尽兴&rdquo;，
              <br />
              再等到我们的初步建议后，
              <br />
              你大可以选择再约。
            </p>
          </div>
        </Slide>

        {/* Slide 6 — 关于费用 */}
        <Slide
          ref={setSlideRef(5)}
          ariaLabel="关于费用"
          hasChevron
          onChevronClick={() => scrollToSlide(6)}
        >
          <div className="text-center space-y-12">
            <p className="text-[36px] sm:text-display font-medium tracking-tight fade-up">
              完全免费
            </p>
            <div className="space-y-7 text-body-lg max-w-md mx-auto">
              <p className="fade-up fade-up-delay-1">
                我们不收费，
                <br />
                也坚决不会像看短剧一样，
                <br />
                在聊天过程中出现突然的付费解锁。
              </p>
              <p className="fade-up fade-up-delay-2">
                之所以这样，是因为我们觉得
                <br />
                &ldquo;想找个人说说话&rdquo;这件事并不应该有门槛。
              </p>
              <p className="fade-up fade-up-delay-3">
                你已经鼓起勇气来这里了，
                <br />
                这已经很勇敢了。
              </p>
            </div>
          </div>
        </Slide>

        {/* Slide 7 — 关于隐私（详细） */}
        <Slide
          ref={setSlideRef(6)}
          ariaLabel="关于隐私"
          hasChevron
          onChevronClick={() => scrollToSlide(7)}
        >
          <div className="space-y-7 text-body-lg">
            <h2 className="text-h2 font-medium tracking-tight fade-up">关于隐私</h2>
            <p className="fade-up fade-up-delay-1">
              我们在这里担保，
              <br />
              与你的聊天内容坚决不会被以任何途径转发或分享给任何人——
            </p>
            <p className="fade-up fade-up-delay-2">不是你的父母、不是你的学校、不是你的公司……</p>
            <p className="fade-up fade-up-delay-3">我们不需要你的真实姓名，不需要你的电话。</p>
            <p className="fade-up fade-up-delay-4">
              聊天记录会在 7 天后自动删除；
              <br />
              当然，你也可以选择用喜欢的任何形式保留我们的对话。
            </p>
            <div className="flex justify-start fade-up fade-up-delay-5">
              <span className="block w-[60px] h-px bg-accent" aria-hidden="true" />
            </div>
            <div className="space-y-4 text-[15px] text-muted leading-relaxed">
              <p className="fade-up fade-up-delay-5">唯一的例外：</p>
              <p className="fade-up fade-up-delay-5">
                如果在聊天中出现明确的、紧急的安全风险（比如有伤害自己或他人的行为），
                <br />
                Listeners 会引导你联系专业的危机干预资源。
              </p>
              <p className="fade-up fade-up-delay-6">
                但请放心，
                <br />
                我们并不会替你打电话，也不会通知任何人——
                <br />
                是否采取这一步，始终由你决定。
              </p>
            </div>
          </div>
        </Slide>

        {/* Slide 8 — 倾听者是谁 */}
        <Slide
          ref={setSlideRef(7)}
          ariaLabel="倾听者是谁"
          hasChevron
          onChevronClick={() => scrollToSlide(8)}
        >
          <div className="space-y-7 text-body-lg">
            <h2 className="text-h2 font-medium tracking-tight fade-up">倾听者是谁</h2>
            <p className="fade-up fade-up-delay-1">
              我们不是专业心理咨询师，也不会这样自称。
            </p>
            <p className="fade-up fade-up-delay-2">
              你我都是普通人，
              <br />
              但我们知道如何正确地倾听，协助进行力所能及的引导，帮助给予相对可行的建议。
            </p>
            <div className="fade-up fade-up-delay-3">
              <p className="mb-3">每一位倾听者在开始之前都会学习：</p>
              <ul className="pl-4 space-y-1.5">
                <li className="flex gap-2">
                  <span className="text-accent">·</span>
                  <span>如何在不评判的前提下倾听</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-accent">·</span>
                  <span>如何识别需要专业介入的情况</span>
                </li>
              </ul>
            </div>
            <p className="fade-up fade-up-delay-4">
              我们能做的事情很有限：
              <br />
              陪你聊聊天；认真听你的故事；必要的时候提醒你&ldquo;这个事情可能需要更专业的人&rdquo;。
            </p>
            <p className="fade-up fade-up-delay-5">
              我们不做诊断，不去开药，
              <br />
              也不会主观替你做任何决定。
            </p>
          </div>
        </Slide>

        {/* Slide 9 — 如果你需要更专业的帮助 */}
        <Slide
          ref={setSlideRef(8)}
          ariaLabel="如果你需要更专业的帮助"
          hasChevron
          onChevronClick={() => scrollToSlide(9)}
        >
          <div className="space-y-7 text-body-lg">
            <h2 className="text-h2 font-medium tracking-tight fade-up">如果我们觉得你需要更专业的帮助</h2>
            <p className="fade-up fade-up-delay-1">我们会直接告诉你。</p>
            <p className="fade-up fade-up-delay-2">
              不是为了把你推走，
              <br />
              而是因为有些情况已经超出了&ldquo;聊一聊&rdquo;能处理的范围——
            </p>
            <p className="fade-up fade-up-delay-3">
              比如持续很久的情绪低落、
              <br />
              影响到吃饭睡觉、
              <br />
              有伤害自己的念头。
            </p>
            <p className="fade-up fade-up-delay-4">
              我们不想耽误你，也不想让你受到伤害。
            </p>
            <p className="fade-up fade-up-delay-5">
              如果到了那一步，
              <br />
              我们会尽力给你一个清晰的下一步方向：
              <br />
              可以去哪里求助，有哪些渠道可以选择，不同情况可以找谁。
            </p>
          </div>
        </Slide>

        {/* Slide 10 — 结尾 / CTA */}
        <Slide ref={setSlideRef(9)} ariaLabel="结尾">
          <div className="text-center">
            <div className="flex justify-center mb-10 fade-up">
              <Logo size={64} className="text-accent" />
            </div>
            <p className="text-[36px] sm:text-display font-medium tracking-tight leading-[1.15] fade-up fade-up-delay-1">
              如果你愿意说，
              <br />
              我们就在。
            </p>
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3 fade-up fade-up-delay-2">
              <Link href="/book" className="btn-primary">预约一次倾诉</Link>
              <Link href="/login" className="btn-ghost">我已有账号，登录</Link>
            </div>
            <div className="mt-24 flex items-center justify-center gap-6 text-caption text-muted fade-up fade-up-delay-3">
              <span>© 2026 OpenLine</span>
              <button
                onClick={toggle}
                aria-label="切换主题"
                className="p-2 rounded-full hover:bg-accent-soft transition-colors"
              >
                {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
              </button>
            </div>
          </div>
        </Slide>
      </div>
    </>
  );
}
