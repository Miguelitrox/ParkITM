"use client"

import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts"
import { CalendarDays, Clock3, DoorOpen, Gauge, Users, UserCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

export interface MetricLog {
  id: string
  control_number: string
  student_name: string
  access_type: "entrada" | "salida"
  access_time: string
  tiempo_respuesta_ms: number | null
}

interface AdminMetricsProps {
  logs: MetricLog[]
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}

const chartConfig = {
  accesos: { label: "Accesos", color: "var(--chart-1)" },
  autorizados: { label: "Autorizados", color: "var(--chart-2)" },
  denegados: { label: "Denegados", color: "var(--chart-3)" },
} satisfies ChartConfig

export function AdminMetrics({ logs, from, to, onFromChange, onToChange }: AdminMetricsProps) {
  const periodLogs = useMemo(() => logs.filter((log) => {
    const day = log.access_time.slice(0, 10)
    return (!from || day >= from) && (!to || day <= to)
  }), [logs, from, to])

  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")} h`,
    accesos: periodLogs.filter((log) => new Date(log.access_time).getHours() === hour).length,
  }))

  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const key = date.toISOString().slice(0, 10)
    return {
      fecha: date.toLocaleDateString("es-MX", { weekday: "short" }),
      autorizados: periodLogs.filter((log) => log.access_time.slice(0, 10) === key).length,
      denegados: 0,
    }
  })

  const averageResponse = periodLogs.length
    ? Math.round(periodLogs.reduce((sum, log) => sum + (log.tiempo_respuesta_ms ?? 0), 0) / periodLogs.length)
    : 0
  const uniqueStudents = new Set(periodLogs.map((log) => log.control_number)).size
  const manualOpenings = 0
  const denialReasons = [{ motivo: "Sin registros", cantidad: 0 }]

  const statCards = [
    { label: "Accesos totales", value: periodLogs.length, icon: DoorOpen },
    { label: "% autorizados", value: periodLogs.length ? "100%" : "0%", icon: UserCheck },
    { label: "Alumnos distintos", value: uniqueStudents, icon: Users },
    { label: "Aperturas manuales", value: manualOpenings, icon: Gauge },
  ]

  return (
    <section aria-labelledby="metrics-title" className="mb-8 flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 id="metrics-title" className="text-xl font-bold text-foreground">Métricas de acceso</h2><p className="text-sm text-muted-foreground">Filtra el periodo para recalcular todo el panel.</p></div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Desde<input type="date" value={from} onChange={(event) => onFromChange(event.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Hasta<input type="date" value={to} onChange={(event) => onToChange(event.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon }) => <Card key={label}><CardContent className="flex items-center gap-3 p-5"><Icon className="size-5 text-primary" aria-hidden="true" /><div><p className="text-2xl font-bold text-foreground">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Accesos por hora del día</CardTitle></CardHeader><CardContent><ChartContainer config={chartConfig} className="h-[260px] w-full"><BarChart accessibilityLayer data={hourly}><CartesianGrid vertical={false} /><XAxis dataKey="hour" tickLine={false} axisLine={false} interval={2} /><YAxis allowDecimals={false} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="accesos" fill="var(--color-accesos)" radius={4} /></BarChart></ChartContainer></CardContent></Card>
        <Card><CardHeader><CardTitle>Autorizados vs denegados · últimos 7 días</CardTitle></CardHeader><CardContent><ChartContainer config={chartConfig} className="h-[260px] w-full"><LineChart accessibilityLayer data={daily}><CartesianGrid vertical={false} /><XAxis dataKey="fecha" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} /><ChartTooltip content={<ChartTooltipContent />} /><Line dataKey="autorizados" stroke="var(--color-autorizados)" strokeWidth={3} dot={false} /><Line dataKey="denegados" stroke="var(--color-denegados)" strokeWidth={3} dot={false} /></LineChart></ChartContainer></CardContent></Card>
        <Card><CardHeader><CardTitle>Motivos de denegación</CardTitle></CardHeader><CardContent><ChartContainer config={chartConfig} className="h-[260px] w-full"><BarChart accessibilityLayer data={denialReasons} layout="vertical"><XAxis type="number" allowDecimals={false} /><YAxis dataKey="motivo" type="category" width={100} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="cantidad" fill="var(--color-denegados)" radius={4} /></BarChart></ChartContainer></CardContent></Card>
        <Card className={averageResponse > 5000 ? "border-destructive" : undefined}><CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="size-5" aria-hidden="true" />Tiempo promedio de respuesta</CardTitle></CardHeader><CardContent><p className={`text-4xl font-bold ${averageResponse > 5000 ? "text-destructive" : "text-foreground"}`}>{averageResponse} ms</p><p className="mt-2 text-sm text-muted-foreground">Calculado con tiempo_respuesta_ms del periodo.</p></CardContent></Card>
      </div>
    </section>
  )
}
