"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { QRScanner } from "@/components/qr-scanner"
import { BarrierAnimation } from "@/components/barrier-animation"
import Link from "next/link"

type Status = "idle" | "scanning" | "validating" | "success" | "denied"

interface ValidationResult {
  activo: boolean
  mensaje: string
  nombre: string
  accessType: "entrada" | "salida" | null
  carrera?: string
}

export default function HomePage() {
  const [status, setStatus] = useState<Status>("idle")
  const [isScanning, setIsScanning] = useState(false)
  const [studentName, setStudentName] = useState<string>("")
  const [lastMessage, setLastMessage] = useState<string>("")
  const [accessType, setAccessType] = useState<"entrada" | "salida" | null>(null)
  const [scanHistory, setScanHistory] = useState<Array<{
    time: string
    name: string
    success: boolean
    type: "entrada" | "salida" | null
  }>>([])

  const handleScan = async (data: string) => {
    setStatus("validating")
    setStudentName("")
    setLastMessage("")
    setAccessType(null)

    try {
      const response = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: data }),
      })

      const result: ValidationResult = await response.json()

      if (result.activo) {
        setStatus("success")
        setStudentName(result.nombre || "ALUMNO")
        setLastMessage(result.mensaje)
        setAccessType(result.accessType)
        
        // Agregar al historial
        setScanHistory(prev => [{
          time: new Date().toLocaleTimeString('es-MX'),
          name: result.nombre || "ALUMNO",
          success: true,
          type: result.accessType
        }, ...prev.slice(0, 4)])

        // Reset despues de 5 segundos
        setTimeout(() => {
          setStatus("idle")
          setStudentName("")
          setAccessType(null)
        }, 5000)
      } else {
        setStatus("denied")
        setLastMessage(result.mensaje)
        setStudentName(result.nombre || "")
        
        // Agregar al historial
        setScanHistory(prev => [{
          time: new Date().toLocaleTimeString('es-MX'),
          name: result.nombre || "DESCONOCIDO",
          success: false,
          type: null
        }, ...prev.slice(0, 4)])

        // Reset despues de 4 segundos
        setTimeout(() => {
          setStatus("idle")
          setStudentName("")
        }, 4000)
      }
    } catch (error) {
      console.error("[v0] Validation error:", error)
      setStatus("denied")
      setLastMessage("Error de conexion")
      
      setTimeout(() => {
        setStatus("idle")
      }, 3000)
    }
  }

  const handleStartScan = () => {
    setIsScanning(true)
    setStatus("scanning")
  }

  const handleStopScan = () => {
    setIsScanning(false)
    if (status === "scanning") {
      setStatus("idle")
    }
  }

  const barrierStatus = status === "validating" ? "scanning" : status === "success" ? "success" : status === "denied" ? "denied" : "idle"

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">PARKITM</h1>
              <p className="text-xs text-muted-foreground">Control de Acceso Vehicular</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${status === "idle" ? "bg-muted-foreground" : status === "scanning" || status === "validating" ? "bg-secondary animate-pulse" : status === "success" ? "bg-success" : "bg-destructive"}`} />
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {status === "idle" ? "En espera" : status === "scanning" ? "Escaneando..." : status === "validating" ? "Validando..." : status === "success" ? "Acceso OK" : "Denegado"}
              </span>
            </div>
            
            {/* Boton de Admin (Candado) */}
            <Link 
              href="/admin/login"
              className="p-2 rounded-lg hover:bg-muted transition-colors group"
              title="Acceso Administrador"
            >
              <svg 
                className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
                />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Seccion del escaner */}
          <div className="space-y-6">
            <div className="text-center lg:text-left">
              <h2 className="text-2xl font-bold text-foreground mb-2">Escanear Credencial</h2>
              <p className="text-muted-foreground">
                Coloca el codigo QR de tu credencial digital frente a la camara
              </p>
            </div>

            <div className="bg-card rounded-2xl p-6 border border-border shadow-xl shadow-primary/5">
              <QRScanner
                onScan={handleScan}
                isScanning={isScanning}
                onStartScan={handleStartScan}
                onStopScan={handleStopScan}
              />
            </div>

            {/* Indicador de estado */}
            <AnimatePresence mode="wait">
              {status === "validating" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-secondary/20 border border-secondary/30 rounded-xl p-4 flex items-center gap-3"
                >
                  <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                  <span className="text-secondary font-medium">Validando credencial...</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Seccion de la animacion */}
          <div className="space-y-6">
            <div className="text-center lg:text-left">
              <h2 className="text-2xl font-bold text-foreground mb-2">Estado del Acceso</h2>
              <p className="text-muted-foreground">
                La barrera se levantara automaticamente si el acceso es autorizado
              </p>
            </div>

            <div className="bg-card rounded-2xl p-6 border border-border shadow-xl shadow-primary/5">
              <BarrierAnimation
                isOpen={status === "success"}
                status={barrierStatus}
                studentName={studentName}
                accessType={accessType}
              />

              {/* Mensaje adicional */}
              <AnimatePresence mode="wait">
                {lastMessage && (status === "success" || status === "denied") && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mt-16 text-center"
                  >
                    <p className={`text-sm font-medium ${status === "success" ? (accessType === "entrada" ? "text-success" : "text-secondary") : "text-destructive"}`}>
                      {lastMessage}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Historial reciente */}
            {scanHistory.length > 0 && (
              <div className="bg-card rounded-2xl p-6 border border-border">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Historial Reciente
                </h3>
                <div className="space-y-2">
                  {scanHistory.map((entry, i) => (
                    <motion.div
                      key={`${entry.time}-${i}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center justify-between py-2 border-b border-border last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${entry.success ? (entry.type === "entrada" ? "bg-success" : "bg-secondary") : "bg-destructive"}`} />
                        <div>
                          <span className="text-sm font-medium text-foreground">{entry.name}</span>
                          {entry.type && (
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${entry.type === "entrada" ? "bg-success/20 text-success" : "bg-secondary/20 text-secondary"}`}>
                              {entry.type === "entrada" ? "Entrada" : "Salida"}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{entry.time}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-card/30 mt-12">
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Instituto Tecnologico de Morelia - Sistema de Control de Acceso v2.2
          </p>
        </div>
      </footer>
    </main>
  )
}
