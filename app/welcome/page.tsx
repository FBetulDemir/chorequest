"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";

import { useAuth } from "@/src/components/AuthProvider";
import { Button, buttonClasses } from "@/src/components/ui/Button";
import { Mascot, type MascotMood } from "@/src/components/ui/Mascot";

type Slide = {
  mood: MascotMood;
  props: string[];
  title: string;
  text: string;
};

const SLIDES: Slide[] = [
  {
    mood: "happy",
    props: ["🧹", "🍽️", "🧺"],
    title: "Share chores fairly",
    text: "Decide who does what, or let ChoreQuest take turns for you. No more “I always do the dishes”.",
  },
  {
    mood: "celebrate",
    props: ["🪙", "✨", "🪙"],
    title: "Earn points for every chore",
    text: "Quick jobs earn a little, big jobs earn a lot. Tick them off together and watch the points roll in.",
  },
  {
    mood: "happy",
    props: ["🏆", "👑", "🔥"],
    title: "Win the week",
    text: "A friendly leaderboard, streaks and badges turn housework into a game you actually want to play.",
  },
];

export default function WelcomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  // Signed-in users go straight to the app
  useEffect(() => {
    if (!loading && user) router.replace("/today");
  }, [loading, user, router]);

  function goTo(i: number) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  }

  function onScroll() {
    const track = trackRef.current;
    if (!track) return;
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  }

  const last = index === SLIDES.length - 1;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col py-4">
      <div className="flex justify-end">
        <Link href="/login" className="rounded-full px-3 py-1.5 text-sm font-bold text-muted hover:text-ink">
          Sign in
        </Link>
      </div>

      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-roledescription="carousel"
        aria-label="What ChoreQuest does">
        {SLIDES.map((s, i) => (
          <section
            key={s.title}
            className="flex w-full shrink-0 snap-center flex-col items-center justify-center px-6 text-center"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${SLIDES.length}`}
            aria-hidden={i !== index}>
            <div className="relative grid h-64 w-64 place-items-center">
              <div className="absolute inset-6 rounded-full bg-(image:--cq-gradient) opacity-20 blur-2xl" />
              <Mascot mood={s.mood} size={150} bob className="relative text-ink" />
              {s.props.map((p, j) => (
                <span
                  key={j}
                  className="animate-pop absolute text-4xl"
                  style={{
                    animationDelay: `${150 + j * 120}ms`,
                    ...[{ left: 8, top: 40 }, { right: 6, top: 18 }, { right: 18, bottom: 34 }][j],
                  }}
                  aria-hidden="true">
                  {p}
                </span>
              ))}
            </div>
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink">{s.title}</h1>
            <p className="mt-3 text-base text-muted">{s.text}</p>
          </section>
        ))}
      </div>

      <div className="mt-6 flex justify-center gap-2" role="tablist" aria-label="Slides">
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => goTo(i)}
            className={clsx(
              "h-2.5 rounded-full transition-all",
              i === index ? "w-7 bg-brand" : "w-2.5 bg-gray-300",
            )}
          />
        ))}
      </div>

      <div className="mt-8 space-y-3 px-2">
        {last ? (
          <Link href="/login?mode=signup" className={buttonClasses({ variant: "primary", size: "lg", block: true })}>
            Get started. It&apos;s free
          </Link>
        ) : (
          <Button variant="primary" size="lg" block onClick={() => goTo(index + 1)}>
            Next
          </Button>
        )}
        <Link href="/login" className={buttonClasses({ variant: "ghost", block: true })}>
          I already have an account
        </Link>
      </div>
    </div>
  );
}
