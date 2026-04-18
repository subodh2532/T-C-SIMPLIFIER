"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CameraPanel } from "@/components/CameraPanel";
import { SectionCard } from "@/components/SectionCard";
import { languages } from "@/lib/languages";
import { getVerdictTone } from "@/lib/score";
import type { AnalysisResult, FetchTermsResponse, OutputLanguage } from "@/lib/types";

const initialResult: AnalysisResult = {
  terms_and_conditions: ["Paste a product link, upload a gallery image, or paste text to begin."],
  advantages: ["Advantages will appear here after analysis."],
  disadvantages: ["Disadvantages will appear here after analysis."],
  precautions: ["Precautions will appear here after analysis."],
  verdict: "Caution",
  verdict_reason: "Waiting for product or terms content.",
  extracted_preview: []
};

export default function HomePage() {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState<OutputLanguage>("English");
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
      setInfo("Image text added successfully. Tap Simplify to get bullets.");
    } catch (ocrError) {
      const message =
        ocrError instanceof Error ? ocrError.message : "Image reading failed. Please try another photo.";
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
      setError("Paste a product or website link first.");
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
          throw new Error("error" in payload ? payload.error : "Could not extract page text.");
        }

        setText(payload.content);
        setInfo(
          `Content auto-filled from ${payload.source}${payload.matchedPath ? ` (${payload.matchedPath})` : ""}. Tap Simplify to continue.`
        );
      } catch (fetchError) {
        const message =
          fetchError instanceof Error ? fetchError.message : "Could not fetch website content.";
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
      setError("Add a product link, gallery image, or pasted text first.");
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
            text,
            language
          })
        });

        const payload = (await response.json()) as AnalysisResult | { error: string };

        if (!response.ok || !("terms_and_conditions" in payload)) {
          throw new Error("error" in payload ? payload.error : "Analysis failed.");
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
        setInfo("Done. Your bullets are ready below.");
      } catch (simplifyError) {
        const message =
          simplifyError instanceof Error
            ? simplifyError.message
            : "Something went wrong while generating the summary.";
        setError(message);
      }
    });
  }

  function buildVoiceText() {
    return [
      `Verdict: ${result.verdict}. ${result.verdict_reason}`,
      "Terms and conditions.",
      ...result.terms_and_conditions,
      "Advantages.",
      ...result.advantages,
      "Disadvantages.",
      ...result.disadvantages,
      "Precautions.",
      ...result.precautions
    ].join(". ");
  }

  function listenSummary() {
    const voiceText = buildVoiceText();
    if (!voiceText.trim()) {
      return;
    }

    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(voiceText);
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
            Product and T&amp;C Simplifier
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            T&amp;C Simplifier
          </h1>
          <p className="max-w-3xl text-base leading-7 text-slate-600">
            Paste any ecommerce product link, upload a photo from your gallery, scan a page, or
            paste text. The app will automatically fetch product description content and show terms
            and conditions, advantages, disadvantages, and
            precautions in bullet points.
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="Paste product URL and auto-fill from product description"
              className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
            <button
              type="button"
              disabled={isFetchingTerms}
              onClick={fetchTermsFromUrl}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isFetchingTerms ? "Loading..." : "Use Link"}
            </button>
          </div>

          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Or paste product details, policy text, or terms here..."
            className="min-h-[220px] w-full rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <label htmlFor="language" className="text-sm font-semibold text-slate-900">
                Output language
              </label>
              <select
                id="language"
                value={language}
                onChange={(event) => setLanguage(event.target.value as OutputLanguage)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
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
              disabled={isSimplifying}
              onClick={simplifyTerms}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-[var(--primary)] px-6 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(31,122,92,0.28)] transition hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSimplifying ? "Simplifying..." : "Simplify"}
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white">
              Upload from Gallery
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
        <SectionCard title="Verdict" description="Quick overall result.">
          <div
            className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${getVerdictTone(result.verdict)}`}
          >
            {result.verdict}
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-700">{result.verdict_reason}</p>
        </SectionCard>

        <SectionCard title="Terms and Conditions" description="Main points in bullet form.">
          <BulletList items={result.terms_and_conditions} />
        </SectionCard>

        <SectionCard title="Advantages" description="Helpful or positive points.">
          <BulletList items={result.advantages} />
        </SectionCard>

        <SectionCard title="Disadvantages" description="Possible downsides or weak points.">
          <BulletList items={result.disadvantages} />
        </SectionCard>

        <SectionCard title="Precautions" description="What to check before buying or agreeing.">
          <BulletList items={result.precautions} />
        </SectionCard>

        <SectionCard title="Source Preview" description="Extracted text used for analysis.">
          {text.trim() ? (
            <div className="max-h-[320px] overflow-auto rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {text}
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-600">Your extracted text will appear here.</p>
          )}
        </SectionCard>
      </section>
    </main>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
          <span className="mt-2 h-2 w-2 rounded-full bg-emerald-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
