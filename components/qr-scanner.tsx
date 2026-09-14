"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode"

interface QRScannerProps {
  onScan: (data: string) => void
  isScanning: boolean
  onStartScan: () => void
  onStopScan: () => void
}

export function QRScanner({ onScan, isScanning, onStartScan, onStopScan }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const hasProcessedRef = useRef(false)

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop()
        }
      } catch {
        // Ignore stop errors
      }
    }
    hasProcessedRef.current = false
  }, [])

  const startScanner = useCallback(async () => {
    if (!containerRef.current) return
    setError(null)
    hasProcessedRef.current = false

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader")
      }

      const state = scannerRef.current.getState()
      if (state === Html5QrcodeScannerState.SCANNING) {
        await scannerRef.current.stop()
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          if (!hasProcessedRef.current) {
            hasProcessedRef.current = true
            onScan(decodedText)
            stopScanner()
            onStopScan()
          }
        },
        () => {
          // QR code not found - ignore
        }
      )
    } catch (err) {
      console.error("[v0] QR Scanner error:", err)
      setError("No se pudo acceder a la camara. Verifica los permisos.")
      onStopScan()
    }
  }, [onScan, onStopScan, stopScanner])

  useEffect(() => {
    if (isScanning) {
      startScanner()
    } else {
      stopScanner()
    }

    return () => {
      stopScanner()
    }
  }, [isScanning, startScanner, stopScanner])

  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div
        id="qr-reader"
        ref={containerRef}
        className={`w-full aspect-square rounded-xl overflow-hidden bg-muted ${
          isScanning ? "block" : "hidden"
        }`}
      />
      
      {!isScanning && (
        <div className="w-full aspect-square rounded-xl bg-muted flex flex-col items-center justify-center gap-4 border-2 border-dashed border-border">
          <div className="relative">
            <svg
              className="w-24 h-24 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
              />
            </svg>
            {/* Esquinas decorativas */}
            <div className="absolute -top-2 -left-2 w-6 h-6 border-l-2 border-t-2 border-primary rounded-tl-lg" />
            <div className="absolute -top-2 -right-2 w-6 h-6 border-r-2 border-t-2 border-primary rounded-tr-lg" />
            <div className="absolute -bottom-2 -left-2 w-6 h-6 border-l-2 border-b-2 border-primary rounded-bl-lg" />
            <div className="absolute -bottom-2 -right-2 w-6 h-6 border-r-2 border-b-2 border-primary rounded-br-lg" />
          </div>
          <p className="text-muted-foreground text-sm text-center px-4">
            Presiona el boton para escanear el codigo QR de tu credencial
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive text-sm text-center">{error}</p>
        </div>
      )}

      <button
        onClick={isScanning ? onStopScan : onStartScan}
        className={`mt-6 w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 ${
          isScanning
            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25"
        }`}
      >
        {isScanning ? (
          <span className="flex items-center justify-center gap-3">
            <span className="w-3 h-3 bg-current rounded-full animate-pulse" />
            Detener Escaneo
          </span>
        ) : (
          <span className="flex items-center justify-center gap-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
              />
            </svg>
            Escanear QR
          </span>
        )}
      </button>
    </div>
  )
}
