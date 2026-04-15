"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CameraPanel } from "@/components/CameraPanel";
import { SectionCard } from "@/components/SectionCard";
import { languages } from "@/lib/languages";
import { getScoreLabel } from "@/lib/score";
import type { FetchTermsResponse, LanguageOption, SimplifiedTerms } from "@/lib/types";

const initialResult: SimplifiedTerms = {
  language: "English",
  summary: [
    "Paste terms, fetch a website page, or scan a document to get a clear breakdown."
  ],
  key_points: ["Important clauses will appear here after analysis."],
  risks: ["Possible risks like auto-renewal or data sharing will be highlighted here."],
  data_usage: ["Data collection and sharing details will appear here after analysis."],
  safety_score: 0
};

export default function HomePage() {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState<LanguageOption>("English");
  const [result, setResult] = useState<SimplifiedTerms>(initialResult);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [ocrProgress, setOcrProgress] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isFetchingTerms, startFetchTransition] = useTransition();
  const speakingRef = useRef(false);

  const selectedLanguage = useMemo(
    () => languages.find((item) => item.label === language) ?? languages[0],
    [language]
  );

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  async function handleOcr(file: File) {
    setError("");
    setInfo("");
    setOcrProgress("Preparing OCR...");

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (message) => {
          if (typeof message.progress === "number") {
            setOcrProgress(`${message.status} ${Math.round(message.progress * 100)}%`);
          }
        }
      });

      await worker.setParameters({
        preserve_interword_spaces: "1"
      });

      const {
        data: { text: extractedText }
      } = await worker.recognize(file);

      await worker.terminate();

      const cleaned = extractedText.replace(/\n{3,}/g, "\n\n").trim();
      if (!cleaned) {
        throw new Error("No readable text found in the image.");
      }

      setText((current) => (current ? `${current}\n\n${cleaned}` : cleaned));
      setInfo("Text extracted successfully and added to the input box.");
    } catch (ocrError) {
      const message =
        ocrError instanceof Error ? ocrError.message : "OCR failed. Please try another image.";
      setError(message);
    } finally {
      setOcrProgress("");
    }
  }

  function stopSpeaking() {
    window.speechSynthesis.cancel();
    speakingRef.current = false;
    setIsPaused(false);
  }

  function listenSummary() {
    if (!result.summary.length) {
      return;
    }

    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(result.summary.join(". "));
    utterance.lang = selectedLanguage.speechCode;
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => {
      speakingRef.current = false;
      setIsPaused(false);
    };

    speakingRef.current = true;
    window.speechSynthesis.speak(utterance);
  }

  function togglePause() {
    if (!speakingRef.current) {
      return;
    }

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      return;
    }

    window.speechSynthesis.pause();
    setIsPaused(true);
  }

  async function fetchTermsFromUrl() {
    setError("");
    setInfo("");

    if (!url.trim()) {
      setError("Enter a website URL to fetch Terms & Conditions.");
      return;
    }

    startFetchTransition(async () => {
      try {
        const response = await fetch("/api/fetch-terms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ url })
        });

        const payload = (await response.json()) as FetchTermsResponse | { error: string };

        if (!response.ok || !("content" in payload)) {
          throw new Error("error" in payload ? payload.error : "Could not extract terms.");
        }

        setText(payload.content);
        setInfo(`Terms content fetched from ${payload.source}.`);
      } catch (fetchError) {
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Could not fetch the website content.";
        setError(message);
      }
    });
  }

  async function simplifyTerms() {
    setError("");
    setInfo("");
    stopSpeaking();

    if (!text.trim()) {
      setError("Add terms text, fetch a URL, or scan a document before simplifying.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/simplify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text,
            language
          })
        });

        const payload = (await response.json()) as SimplifiedTerms | { error: string };

        if (!response.ok || !("summary" in payload)) {
          throw new Error("error" in payload ? payload.error : "Simplification failed.");
        }

        setResult(payload);
      } catch (simplifyError) {
        const message =
          simplifyError instanceof Error
            ? simplifyError.message
            : "Something went wrong while simplifying the terms.";
        setError(message);
      }
    });
  }

  const score = result.safety_score;
  const scoreState = getScoreLabel(score);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[36px] border border-white/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(240,247,255,0.92))] p-6 shadow-[0_30px_120px_rgba(37,99,235,0.18)] sm:p-8 lg:p-10">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_60%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
              AI + OCR + Voice
            </div>
            <div className="space-y-4">
              <h1
                className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                T&C Simplifier
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Turn dense legal text, website terms, and printed notices into clear bullet points
                in the language people actually understand.
              </p>
            </div>

            <div className="grid gap-4 rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="Paste a website URL to fetch Terms & Conditions..."
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
                <button
                  type="button"
                  disabled={isFetchingTerms}
                  onClick={fetchTermsFromUrl}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isFetchingTerms ? "Fetching..." : "Fetch Terms"}
                </button>
              </div>

              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Paste Terms & Conditions here..."
                className="min-h-[260px] w-full rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />

              <CameraPanel onCapture={handleOcr} busy={isPending || isFetchingTerms} />

              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <div className="space-y-2">
                  <label htmlFor="language" className="text-sm font-semibold text-slate-800">
                    Preferred language
                  </label>
                  <select
                    id="language"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as LanguageOption)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  >
                    {languages.map((item) => (
                      <option key={item.label} value={item.label}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">{selectedLanguage.helper}</p>
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={simplifyTerms}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(37,99,235,0.3)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {isPending ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Simplifying...
                    </>
                  ) : (
                    "Simplify Terms"
                  )}
                </button>
              </div>

              {ocrProgress ? (
                <p className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                  {ocrProgress}
                </p>
              ) : null}

              {info ? (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {info}
                </p>
              ) : null}

              {error ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-[28px] border border-white/70 bg-slate-950 px-6 py-7 text-white shadow-[0_22px_50px_rgba(15,23,42,0.22)]">
              <p className="text-sm uppercase tracking-[0.24em] text-blue-200">Safety Score</p>
              <div className="mt-4 flex items-end gap-3">
                <span className="text-6xl font-semibold">{score || "--"}</span>
                <span className="pb-2 text-sm text-slate-300">/10</span>
              </div>
              <div
                className={`mt-4 inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${scoreState.tone}`}
              >
                {score ? scoreState.text : "Awaiting analysis"}
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#ef4444_0%,#f59e0b_45%,#22c55e_100%)] transition-all duration-500"
                  style={{ width: `${Math.min(Math.max(score, 0), 10) * 10}%` }}
                />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Higher scores mean fewer risky conditions, clearer data handling, and less surprise
                billing or liability exposure.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
              <h2 className="text-lg font-semibold text-slate-900">Voice Output</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Listen in the selected language using your browser&apos;s speech engine.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={listenSummary}
                  className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
                >
                  Listen Summary
                </button>
                <button
                  type="button"
                  onClick={togglePause}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  {isPaused ? "Resume" : "Pause"}
                </button>
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Stop
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(135deg,rgba(37,99,235,0.08),rgba(20,184,166,0.08))] p-6 shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
              <h2 className="text-lg font-semibold text-slate-900">What it catches</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                <li>Auto-renewals, hidden charges, refunds, and liability limits</li>
                <li>What personal data is collected, used, or shared</li>
                <li>Clear summary bullets for students and non-legal users</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Summary" items={result.summary} />
        <SectionCard title="Key Points" items={result.key_points} />
        <SectionCard title="Risk Alerts" items={result.risks} tone="risk" />
        <SectionCard title="Data Usage" items={result.data_usage} />
      </section>
    </main>
  );
}
