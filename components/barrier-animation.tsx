"use client"

import { motion } from "framer-motion"

interface BarrierAnimationProps {
  isOpen: boolean
  status: "idle" | "scanning" | "success" | "denied"
  studentName?: string
  accessType?: "entrada" | "salida" | null
}

export function BarrierAnimation({ isOpen, status, studentName, accessType }: BarrierAnimationProps) {
  const barrierRotation = isOpen ? -85 : 0

  return (
    <div className="relative w-full max-w-md h-64 mx-auto">
      {/* Fondo con gradiente */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-background rounded-xl overflow-hidden">
        {/* Lineas de carretera */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-muted/50">
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4">
            <div className="w-12 h-1 bg-secondary/60 rounded-full" />
            <div className="w-12 h-1 bg-secondary/60 rounded-full" />
            <div className="w-12 h-1 bg-secondary/60 rounded-full" />
          </div>
        </div>

        {/* Poste de la barrera */}
        <div className="absolute bottom-16 left-1/4 w-6 h-32 bg-gradient-to-t from-muted to-border rounded-t-lg shadow-lg">
          {/* Indicador LED */}
          <motion.div
            className="absolute top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
            animate={{
              backgroundColor: status === "success" 
                ? "oklch(0.65 0.2 145)" 
                : status === "denied" 
                ? "oklch(0.55 0.22 25)"
                : status === "scanning"
                ? "oklch(0.75 0.15 85)"
                : "oklch(0.4 0 0)",
              boxShadow: status === "idle" 
                ? "0 0 0px 0px transparent"
                : status === "success"
                ? "0 0 15px 5px oklch(0.65 0.2 145 / 0.5)"
                : status === "denied"
                ? "0 0 15px 5px oklch(0.55 0.22 25 / 0.5)"
                : "0 0 15px 5px oklch(0.75 0.15 85 / 0.5)"
            }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Brazo de la barrera (pluma) */}
        <motion.div
          className="absolute bottom-[11.5rem] left-[calc(25%+0.75rem)] origin-left"
          animate={{ 
            rotate: barrierRotation,
            x: status === "denied" ? [0, -3, 3, -3, 3, 0] : 0
          }}
          transition={{ 
            rotate: { duration: 0.8, ease: "easeInOut" },
            x: { duration: 0.4, ease: "easeInOut", repeat: status === "denied" ? 2 : 0 }
          }}
        >
          {/* Brazo principal */}
          <div className="relative w-48 h-4 bg-gradient-to-r from-destructive via-destructive to-secondary rounded-r-full shadow-lg">
            {/* Franjas reflectivas */}
            <div className="absolute inset-y-0 left-4 right-4 flex items-center gap-3">
              <div className="w-6 h-2 bg-foreground/90 rounded-full" />
              <div className="w-6 h-2 bg-foreground/90 rounded-full" />
              <div className="w-6 h-2 bg-foreground/90 rounded-full" />
              <div className="w-6 h-2 bg-foreground/90 rounded-full" />
            </div>
            {/* Punta de la barrera */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-6 bg-secondary rounded-full" />
          </div>
        </motion.div>

        {/* Efecto de brillo cuando se abre */}
        {status === "success" && (
          <motion.div
            className={`absolute inset-0 bg-gradient-to-t ${accessType === "salida" ? "from-secondary/10" : "from-success/10"} to-transparent`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
        )}

        {/* Efecto rojo cuando se niega */}
        {status === "denied" && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-t from-destructive/10 to-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0, 0.5, 0] }}
            transition={{ duration: 0.8, repeat: 2 }}
          />
        )}
      </div>

      {/* Mensaje de bienvenida/despedida */}
      <motion.div
        className="absolute -bottom-12 left-0 right-0 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ 
          opacity: status === "success" || status === "denied" ? 1 : 0,
          y: status === "success" || status === "denied" ? 0 : 10
        }}
        transition={{ duration: 0.3 }}
      >
        {status === "success" && (
          <div className="space-y-1">
            {accessType === "entrada" ? (
              <>
                <p className="text-success font-bold text-lg">BIENVENIDO</p>
                {studentName && (
                  <p className="text-foreground font-medium">{studentName}</p>
                )}
              </>
            ) : (
              <>
                <p className="text-secondary font-bold text-lg">QUE TENGA BUEN DIA</p>
                {studentName && (
                  <p className="text-foreground font-medium">{studentName}</p>
                )}
              </>
            )}
          </div>
        )}
        {status === "denied" && (
          <div className="space-y-1">
            <p className="text-destructive font-bold text-lg">ACCESO DENEGADO</p>
            <p className="text-muted-foreground text-sm">Credencial no valida o alumno inactivo</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
