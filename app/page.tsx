"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CameraPanel } from "@/components/CameraPanel";
import { SectionCard } from "@/components/SectionCard";
import { getRiskTone, getVerdictTone } from "@/lib/score";
import type { AnalysisResult, FetchTermsResponse } from "@/lib/types";

const initialResult: AnalysisResult = {
  summary: ["Paste text, upload an image, scan a page, or add a website link to begin."],
  risks: [
    {
      level: "Low",
      title: "Nothing analyzed yet",
      detail: "Once you run Simplify, the main risks will appear here."
    }
  ],
  verdict: "Caution",
  verdict_reason: "Waiting for some Terms & Conditions text.",
  extracted_preview: []
};

const quickExamples = [
  "Paste a product return policy",
  "Upload a shopping app screenshot",
  "Scan a printed contract",
  "Try a direct privacy or terms link"
];

export default function HomePage() {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<AnalysisResult>(initialResult);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [ocrProgress, setOcrProgress] = useState("");
  const [lastAction, setLastAction] = useState<"ocr" | "url" | "simplify" | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isSimplifying, startSimplifying] = useTransition();
  const [isFetchingTerms, startFetchingTerms] = useTransition();
  const speakingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  async function handleOcr(file: File) {
    setLastAction("ocr");
    setError("");
    setInfo("");
    setOcrProgress("Reading image...");

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
        throw new Error("No readable text was found in that image.");
      }

      setText(cleaned);
      setInfo("Text added from your image. Now tap Simplify.");
    } catch (ocrError) {
      const message =
        ocrError instanceof Error ? ocrError.message : "OCR failed. Please try another image.";
      setError(message);
    } finally {
      setOcrProgress("");
    }
  }

  async function fetchTermsFromUrl() {
    setLastAction("url");
    setError("");
    setInfo("");

    if (!url.trim()) {
      setError("Paste a website URL first.");
      return;
    }

    startFetchingTerms(async () => {
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
          throw new Error("error" in payload ? payload.error : "Could not extract legal text.");
        }

        setText(payload.content);
        setInfo(
          `Found legal text from ${payload.source}${payload.matchedPath ? ` (${payload.matchedPath})` : ""}. Now tap Simplify.`
        );
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
    setLastAction("simplify");
    setError("");
    setInfo("");
    stopSpeaking();

    if (!text.trim()) {
      setError("Add text first. You can paste text, upload an image, scan, or use a URL.");
      return;
    }

    startSimplifying(async () => {
      try {
        const response = await fetch("/api/simplify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ text })
        });

        const payload = (await response.json()) as AnalysisResult | { error: string };

        if (!response.ok || !("summary" in payload)) {
          throw new Error("error" in payload ? payload.error : "Simplification failed.");
        }

        setResult({
          ...payload,
          extracted_preview:
            payload.extracted_preview.length > 0
              ? payload.extracted_preview
              : text
                  .split(/\n+/)
                  .map((item) => item.trim())
                  .filter(Boolean)
                  .slice(0, 4)
        });
        setInfo("Done. You can review the summary below or listen to it.");
      } catch (simplifyError) {
        const message =
          simplifyError instanceof Error
            ? simplifyError.message
            : "Something went wrong while simplifying the terms.";
        setError(message);
      }
    });
  }

  function listenSummary() {
    if (!result.summary.length) {
      return;
    }

    stopSpeaking();

    const fullText = [
      `Verdict: ${result.verdict}. ${result.verdict_reason}`,
      ...result.summary
    ].join(". ");

    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.lang = "en-US";
    utterance.onend = () => {
      speakingRef.current = false;
      setIsPaused(false);
    };

    speakingRef.current = true;
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    window.speechSynthesis.cancel();
    speakingRef.current = false;
    setIsPaused(false);
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

  function retryLastAction() {
    if (lastAction === "url") {
      void fetchTermsFromUrl();
      return;
    }

    if (lastAction === "simplify") {
      void simplifyTerms();
      return;
    }

    if (lastAction === "ocr") {
      fileInputRef.current?.click();
    }
  }

  const busy = isFetchingTerms || isSimplifying || Boolean(ocrProgress);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6 lg:py-10">
      <section className="rounded-[32px] border border-white/70 bg-white/88 p-5 shadow-[0_24px_80px_rgba(16,40,29,0.1)] sm:p-8">
        <div className="space-y-4">
          <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
            Simple T&amp;C Checker
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            T&amp;C Simplifier
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-600">
            Keep it simple: add a link, paste the text, or upload a screenshot. The app will pull
            out the important points, flag the risks, and give you a quick verdict.
          </p>
        </div>

        <div className="mt-6 rounded-[28px] border border-emerald-100 bg-emerald-50/70 p-4">
          <p className="text-sm font-semibold text-slate-900">Best for Amazon / Flipkart / ecommerce links</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Homepages often block or hide legal text. If a homepage link fails, try the site&apos;s
            direct privacy policy, terms page, or return policy link instead.
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="Paste website URL"
              className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
            <button
              type="button"
              disabled={isFetchingTerms}
              onClick={fetchTermsFromUrl}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isFetchingTerms ? "Checking..." : "Use Link"}
            </button>
          </div>

          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Or paste Terms & Conditions text here..."
            className="min-h-[240px] w-full rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />

          <div className="flex flex-wrap gap-3">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white">
              Upload Image
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    return;
                  }

                  await handleOcr(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>

            <button
              type="button"
              disabled={isSimplifying}
              onClick={simplifyTerms}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-6 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(31,122,92,0.28)] transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSimplifying ? "Simplifying..." : "Simplify"}
            </button>

            <button
              type="button"
              onClick={listenSummary}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              Listen
            </button>

            <button
              type="button"
              onClick={togglePause}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {isPaused ? "Resume" : "Pause"}
            </button>

            <button
              type="button"
              onClick={stopSpeaking}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Stop
            </button>

            {lastAction ? (
              <button
                type="button"
                onClick={retryLastAction}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
              >
                Retry
              </button>
            ) : null}
          </div>

          <CameraPanel onCapture={handleOcr} busy={busy} />

          <div className="flex flex-wrap gap-2">
            {quickExamples.map((item) => (
              <span
                key={item}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
              >
                {item}
              </span>
            ))}
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
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Verdict" description="The quick answer.">
          <div
            className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${getVerdictTone(result.verdict)}`}
          >
            {result.verdict}
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-700">{result.verdict_reason}</p>
        </SectionCard>

        <SectionCard title="Summary" description="The main points in plain English.">
          <ul className="space-y-3">
            {result.summary.map((item, index) => (
              <li
                key={`summary-${index}`}
                className="flex items-start gap-3 text-sm leading-6 text-slate-700"
              >
                <span className="mt-2 h-2 w-2 rounded-full bg-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Risks" description="What deserves extra attention.">
          <div className="space-y-3">
            {result.risks.map((risk, index) => (
              <div
                key={`${risk.title}-${index}`}
                className={`rounded-[22px] border p-4 ${getRiskTone(risk.level)}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{risk.title}</p>
                  <span className="rounded-full border border-current/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                    {risk.level}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6">{risk.detail}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Preview" description="The text used for analysis.">
          {text.trim() ? (
            <div className="max-h-[320px] overflow-auto rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {text}
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-600">Your extracted or pasted text will appear here.</p>
          )}
        </SectionCard>
      </section>
    </main>
  );
}
