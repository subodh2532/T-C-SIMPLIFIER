"use client";

import { useEffect, useRef, useState } from "react";

type CameraPanelProps = {
  onCapture: (file: File) => Promise<void>;
  busy: boolean;
};

export function CameraPanel({ onCapture, busy }: CameraPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  async function startCamera() {
    setCameraError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });

      streamRef.current = stream;
      setCameraOpen(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError("Camera access failed. You can still upload an image instead.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  async function captureImage() {
    if (!videoRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Could not capture the image. Please try again.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    if (!blob) {
      setCameraError("Could not capture the image. Please try again.");
      return;
    }

    const file = new File([blob], `tnc-scan-${Date.now()}.jpg`, {
      type: "image/jpeg"
    });

    await onCapture(file);
    stopCamera();
  }

  return (
    <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Camera scan</p>
          <p className="text-sm text-slate-600">
            Use your device camera to capture printed or on-screen terms.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={cameraOpen ? stopCamera : startCamera}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cameraOpen ? "Close Camera" : "Open Camera"}
        </button>
      </div>

      {cameraError ? (
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {cameraError}
        </p>
      ) : null}

      {cameraOpen ? (
        <div className="mt-4 overflow-hidden rounded-[22px] border border-slate-200 bg-slate-950 p-3">
          <video
            ref={videoRef}
            playsInline
            muted
            className="max-h-[360px] w-full rounded-[18px] object-cover"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={captureImage}
              className="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Capture Photo
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex h-10 items-center justify-center rounded-full border border-white/25 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
