"use client";

import * as React from "react";
import { Camera, CameraOff, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

type ScannerLabels = {
  start: string;
  stop: string;
  unsupported: string;
  permissionError: string;
  scanning: string;
};

export function QrScanner({
  labels,
  onScan,
  className,
}: {
  labels: ScannerLabels;
  onScan: (value: string) => void;
  className?: string;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const frameRef = React.useRef<number | null>(null);
  const activeRef = React.useRef(false);
  const [isScanning, setIsScanning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isSupported = typeof window !== "undefined"
    && "BarcodeDetector" in window
    && Boolean(navigator.mediaDevices?.getUserMedia);

  React.useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  async function startScanner() {
    setError(null);

    const detectorCtor = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!detectorCtor || !navigator.mediaDevices?.getUserMedia) {
      setError(labels.unsupported);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      streamRef.current = stream;
      activeRef.current = true;
      setIsScanning(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new detectorCtor({ formats: ["qr_code"] });
      const tick = async () => {
        if (!activeRef.current || !videoRef.current) return;

        try {
          const results = await detector.detect(videoRef.current);
          const value = results[0]?.rawValue;
          if (value) {
            onScan(value);
            stopScanner();
            return;
          }
        } catch {
          // Browser support differs; keep the manual QR input as the reliable fallback.
        }

        frameRef.current = window.requestAnimationFrame(tick);
      };

      frameRef.current = window.requestAnimationFrame(tick);
    } catch {
      setError(labels.permissionError);
      stopScanner();
    }
  }

  function stopScanner() {
    activeRef.current = false;
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }

  return (
    <div className={cn("rounded-lg border bg-muted/15 p-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <ScanLine className="size-4 text-primary" />
          {isScanning ? labels.scanning : isSupported ? labels.start : labels.unsupported}
        </div>
        <Button
          type="button"
          size="sm"
          variant={isScanning ? "outline" : "default"}
          onClick={isScanning ? stopScanner : startScanner}
        >
          {isScanning ? <CameraOff className="size-3.5" /> : <Camera className="size-3.5" />}
          {isScanning ? labels.stop : labels.start}
        </Button>
      </div>

      <div className="mt-3 aspect-video overflow-hidden rounded-md bg-background">
        <video
          ref={videoRef}
          muted
          playsInline
          className={cn("size-full object-cover", !isScanning && "hidden")}
        />
        {!isScanning && (
          <div className="grid size-full place-items-center text-xs font-semibold text-muted-foreground">
            <Camera className="mb-2 size-5" />
            {isSupported ? labels.start : labels.unsupported}
          </div>
        )}
      </div>

      {error ? (
        <p className="mt-2 text-xs font-semibold text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
