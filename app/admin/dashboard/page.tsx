import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AdminDashboardClient } from "./client"

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect("/admin/login")
  }

  // Obtener los logs de acceso
  const { data: accessLogs } = await supabase
    .from("access_logs")
    .select("*")
    .order("access_time", { ascending: false })
    .limit(100)

  // Obtener estadisticas
  const { data: todayLogs } = await supabase
    .from("access_logs")
    .select("id, access_type")
    .gte("access_time", new Date().toISOString().split("T")[0])

  const { data: currentlyInside } = await supabase
    .from("student_status")
    .select("control_number")
    .eq("is_inside", true)

  const stats = {
    totalToday: todayLogs?.length || 0,
    entriesCount: todayLogs?.filter(l => l.access_type === "entrada").length || 0,
    exitsCount: todayLogs?.filter(l => l.access_type === "salida").length || 0,
    currentlyInside: currentlyInside?.length || 0,
  }

  return (
    <AdminDashboardClient 
      initialLogs={accessLogs || []} 
      stats={stats}
      userEmail={user.email || ""}
    />
  )
}
