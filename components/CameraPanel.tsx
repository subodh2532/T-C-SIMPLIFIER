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
        video: {
          facingMode: "environment"
        },
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

    const file = new File([blob], `terms-scan-${Date.now()}.jpg`, {
      type: "image/jpeg"
    });

    await onCapture(file);
    stopCamera();
  }

  return (
    <div className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-base font-semibold text-slate-900">Scan with Camera</p>
          <p className="text-sm text-slate-600">
            Capture a printed form or upload a photo to pull text with OCR.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={cameraOpen ? stopCamera : startCamera}
            className="rounded-full border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50"
          >
            {cameraOpen ? "Close Camera" : "Scan Document"}
          </button>
          <label className="cursor-pointer rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
            Upload Image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }

                await onCapture(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {cameraError ? (
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {cameraError}
        </p>
      ) : null}

      {cameraOpen ? (
        <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-950/95 p-3">
          <video
            ref={videoRef}
            playsInline
            muted
            className="max-h-[360px] w-full rounded-[18px] object-cover"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={captureImage}
              disabled={busy}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              Capture Photo
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
