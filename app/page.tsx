"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CameraPanel } from "@/components/CameraPanel";
import { SectionCard } from "@/components/SectionCard";
import { getRiskTone, getVerdictTone } from "@/lib/score";
import type { AnalysisResult, FetchTermsResponse, InputMode } from "@/lib/types";

const inputOptions: {
  mode: InputMode;
  title: string;
  description: string;
}[] = [
  {
    mode: "camera",
    title: "Scan T&C",
    description: "Use your camera to capture printed or app-based terms."
  },
  {
    mode: "upload",
    title: "Upload Image",
    description: "Drop in screenshots or photos for OCR extraction."
  },
  {
    mode: "text",
    title: "Paste Text",
    description: "Paste raw Terms & Conditions directly into the editor."
  },
  {
    mode: "url",
    title: "Paste URL",
    description: "Fetch legal pages like terms, privacy, or legal notices."
  }
];

const initialResult: AnalysisResult = {
  summary: [
    "Your simplified overview will appear here after you scan, upload, paste, or fetch a terms document."
  ],
  risks: [
    {
      level: "Low",
      title: "Waiting for analysis",
      detail: "Run Simplify to see risk highlights and a final verdict."
    }
  ],
  verdict: "Caution",
  verdict_reason: "Add some T&C content to begin.",
  extracted_preview: []
};

export default function HomePage() {
  const [activeMode, setActiveMode] = useState<InputMode>("text");
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
        throw new Error("No readable text was found in that image.");
      }

      setText(cleaned);
      setInfo("Text extracted successfully. Review the preview and simplify when ready.");
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

    const fullText = [
      `Verdict: ${result.verdict}. ${result.verdict_reason}`,
      "Summary.",
      ...result.summary
    ].join(". ");

    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.lang = "en-US";
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
        setActiveMode("url");
        setInfo(
          `Loaded legal text from ${payload.source}${payload.matchedPath ? ` (${payload.matchedPath})` : ""}.`
        );
      } catch (fetchError) {
        const message =
          fetchError instanceof Error ? fetchError.message : "Could not fetch the website content.";
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
      setError("Add T&C content first by scanning, uploading, pasting text, or analyzing a URL.");
      return;
    }

    startSimplifying(async () => {
      try {
        const response = await fetch("/api/simplify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text
          })
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
        setInfo("Analysis complete. Review the summary, risks, and verdict below.");
      } catch (simplifyError) {
        const message =
          simplifyError instanceof Error
            ? simplifyError.message
            : "Something went wrong while simplifying the terms.";
        setError(message);
      }
    });
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

  const busy = isSimplifying || isFetchingTerms || Boolean(ocrProgress);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="relative overflow-hidden rounded-[36px] border border-white/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(237,246,239,0.92))] p-6 shadow-[0_30px_110px_rgba(16,40,29,0.12)] sm:p-8 lg:p-10">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(31,122,92,0.22),transparent_60%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
              OCR + URL Fetch + OpenRouter + Voice
            </div>

            <div className="space-y-4">
              <h1
                className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl"
              >
                T&amp;C Simplifier
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Understand dense Terms &amp; Conditions in seconds. Scan a document, upload an
                image, paste the text, or point us to a website URL and get a clean summary,
                risk highlights, and a verdict you can actually use.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {inputOptions.map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => setActiveMode(option.mode)}
                  className={`rounded-[24px] border p-4 text-left transition ${
                    activeMode === option.mode
                      ? "border-emerald-300 bg-emerald-50 shadow-[0_14px_40px_rgba(31,122,92,0.15)]"
                      : "border-white/70 bg-white/80 hover:border-emerald-200 hover:bg-white"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-950">{option.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{option.description}</p>
                </button>
              ))}
            </div>

            <div className="grid gap-4 rounded-[28px] border border-white/70 bg-white/78 p-5 shadow-[0_16px_45px_rgba(18,33,26,0.08)] backdrop-blur">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="Paste a website URL to analyze legal pages..."
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
                <button
                  type="button"
                  disabled={isFetchingTerms}
                  onClick={fetchTermsFromUrl}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isFetchingTerms ? "Analyzing URL..." : "Analyze URL"}
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                <div className="space-y-4">
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Paste Terms & Conditions here, or fetch/scan them using the options above..."
                    className="min-h-[280px] w-full rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />

                  <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white">
                    Upload Image for OCR
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

                        setActiveMode("upload");
                        await handleOcr(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>

                <CameraPanel onCapture={handleOcr} busy={busy} />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={isSimplifying}
                  onClick={simplifyTerms}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-6 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(31,122,92,0.28)] transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSimplifying ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Simplifying...
                    </>
                  ) : (
                    "Simplify"
                  )}
                </button>
                <button
                  type="button"
                  onClick={listenSummary}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  Listen Summary
                </button>
                <button
                  type="button"
                  onClick={togglePause}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  {isPaused ? "Resume Audio" : "Pause Audio"}
                </button>
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Stop Audio
                </button>
                {lastAction ? (
                  <button
                    type="button"
                    onClick={retryLastAction}
                    className="inline-flex h-12 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                  >
                    Retry Last Action
                  </button>
                ) : null}
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
            <div className="rounded-[28px] border border-white/70 bg-slate-950 px-6 py-7 text-white shadow-[0_22px_50px_rgba(18,33,26,0.22)]">
              <p className="text-sm uppercase tracking-[0.24em] text-emerald-200">Final Verdict</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div
                  className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${getVerdictTone(result.verdict)}`}
                >
                  {result.verdict}
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">{result.verdict_reason}</p>
              <div className="mt-6 rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">Current input mode</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {inputOptions.find((option) => option.mode === activeMode)?.title}
                </p>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(135deg,rgba(31,122,92,0.1),rgba(244,185,66,0.12))] p-6 shadow-[0_16px_45px_rgba(18,33,26,0.08)]">
              <h2 className="text-lg font-semibold text-slate-900">What this MVP does</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                <li>Extracts text from screenshots, camera scans, and website legal pages</li>
                <li>Uses OpenRouter to simplify clauses into plain language</li>
                <li>Flags risky clauses with high, medium, and low severity levels</li>
                <li>Reads the result aloud with your browser&apos;s speech engine</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Extracted Text Preview"
          description="The source text that will be summarized and risk-scored."
        >
          {text.trim() ? (
            <div className="max-h-[360px] overflow-auto rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {text}
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-600">
              No text yet. Use one of the four input options above to populate this area.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Summary"
          description="Plain-language bullets explaining what the agreement actually says."
        >
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

        <SectionCard
          title="Risk Highlights"
          description="Color-coded issues that deserve extra attention before you accept."
        >
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

        <SectionCard
          title="Supporting Excerpts"
          description="Helpful snippets used to ground the explanation."
        >
          {result.extracted_preview.length ? (
            <ul className="space-y-3">
              {result.extracted_preview.map((item, index) => (
                <li
                  key={`preview-${index}`}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-6 text-slate-600">
              Excerpts will appear here after analysis to show the clauses behind the summary.
            </p>
          )}
        </SectionCard>
      </section>
    </main>
  );
}
