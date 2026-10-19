import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service credentials are not configured")
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

// Solo se aceptan QR de la credencial digital oficial del ITM
const HOST_CREDENCIAL = "sim.morelia.tecnm.mx"
const RUTA_CREDENCIAL = "/qr-credencial-estudiante"

// Numero de control: 8 digitos, opcionalmente con letra al inicio (ej. C19120123)
const PATRON_NUMERO_CONTROL = /^[A-Z]?\d{7,10}$/i

// Nombre: de 2 a 8 palabras formadas solo por letras (incluye acentos y Ñ)
const PATRON_NOMBRE = /^[A-ZÁÉÍÓÚÜÑ]+(?: [A-ZÁÉÍÓÚÜÑ]+){1,7}$/i

interface DatosCredencial {
  nombre: string
  numeroControl: string
  carrera: string
  estatus: string
  activo: boolean
}

function esUrlCredencial(url: URL): boolean {
  return url.hostname === HOST_CREDENCIAL && url.pathname.startsWith(RUTA_CREDENCIAL)
}

function decodificarEntidades(texto: string): string {
  const acentos: Record<string, string> = { acute: "́", tilde: "̃", uml: "̈" }
  return texto
    .replace(/&nbsp;/g, " ")
    .replace(/&([A-Za-z])(acute|tilde|uml);/g, (_, letra, tipo) => (letra + acentos[tipo]).normalize("NFC"))
    .replace(/&#(\d+);/g, (_, codigo) => String.fromCharCode(Number(codigo)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}

// Convierte el HTML en una lista de lineas con el texto visible (una por elemento)
function extraerLineas(html: string): string[] {
  const texto = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n")

  return decodificarEntidades(texto)
    .split("\n")
    .map(l => l.replace(/\s+/g, " ").trim())
    .filter(l => l.length > 0)
}

/*
 * Estructura de la credencial (sim.morelia.tecnm.mx):
 *   ESTUDIANTE
 *   ACTIVO REGULAR                          <- estatus
 *   APELLIDO APELLIDO NOMBRE(S)             <- nombre
 *   23560518                                <- numero de control
 *   INGENIERÍA EN SISTEMAS COMPUTACIONALES  <- carrera
 *   Semestre: 7
 * Antes aparece un tooltip con los nombres de los autores del sistema,
 * por eso el nombre se toma a partir del estatus y anclado al numero de control.
 */
function extraerDatosCredencial(html: string): DatosCredencial {
  const lineas = extraerLineas(html)

  const idxTipo = lineas.findIndex(l => l.toUpperCase() === "ESTUDIANTE")
  const idxEstatus = idxTipo !== -1
    ? idxTipo + 1
    : lineas.findIndex(l => /\b(IN)?ACTIVO\b/i.test(l))
  const estatus = idxEstatus !== -1 && idxEstatus < lineas.length ? lineas[idxEstatus] : ""

  // \bACTIVO evita que "INACTIVO" se tome como activo
  const activo = /^ACTIVO\b/i.test(estatus) || /^DADO DE ALTA$/i.test(estatus)

  // El numero de control va justo despues del nombre
  const inicio = Math.max(idxEstatus + 1, 1)
  let nombre = ""
  let numeroControl = ""
  let carrera = ""

  for (let i = inicio; i < lineas.length; i++) {
    if (PATRON_NUMERO_CONTROL.test(lineas[i]) && PATRON_NOMBRE.test(lineas[i - 1])) {
      numeroControl = lineas[i].toUpperCase()
      nombre = lineas[i - 1].toUpperCase()

      const siguiente = lineas[i + 1] ?? ""
      if (siguiente && !/[\d:]/.test(siguiente)) {
        carrera = siguiente.toUpperCase()
      }
      break
    }
  }

  return { nombre, numeroControl, carrera, estatus, activo }
}

async function registrarAcceso(
  controlNumber: string,
  studentName: string,
  carrera: string,
  qrUrl: string,
  isEntry: boolean,
  tiempoRespuestaMs: number
): Promise<{ accessType: "entrada" | "salida" }> {
  const accessType = isEntry ? "entrada" : "salida"

  // Registrar en la bitacora
  const supabaseAdmin = getSupabaseAdmin()

  const { error: logError } = await supabaseAdmin.from("access_logs").insert({
    control_number: controlNumber,
    student_name: studentName,
    carrera: carrera || null,
    qr_url: qrUrl,
    access_type: accessType,
    access_time: new Date().toISOString(),
    tiempo_respuesta_ms: tiempoRespuestaMs,
  })
  if (logError) console.error("[v0] Error inserting access log:", logError)

  // Actualizar el estado del estudiante
  const { error: statusError } = await supabaseAdmin.from("student_status").upsert({
    control_number: controlNumber,
    student_name: studentName,
    carrera: carrera || null,
    is_inside: isEntry,
    last_access: new Date().toISOString(),
  }, {
    onConflict: "control_number"
  })
  if (statusError) console.error("[v0] Error updating student status:", statusError)

  return { accessType }
}

async function verificarEstadoEstudiante(controlNumber: string): Promise<boolean | null> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data } = await supabaseAdmin
    .from("student_status")
    .select("is_inside")
    .eq("control_number", controlNumber)
    .single()

  return data?.is_inside ?? null
}

export async function POST(request: NextRequest) {
  const startedAt = performance.now()
  try {
    const { url } = await request.json()

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL no proporcionada" },
        { status: 400 }
      )
    }

    // Validar que sea una URL valida
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url.trim())
    } catch {
      return NextResponse.json(
        { error: "URL invalida" },
        { status: 400 }
      )
    }

    // Validar que el QR sea de una credencial del ITM
    if (!esUrlCredencial(parsedUrl)) {
      return NextResponse.json({
        activo: false,
        mensaje: "El QR no corresponde a una credencial digital del ITM.",
        nombre: "",
        accessType: null
      })
    }

    const qrUrl = parsedUrl.toString()

    // Hacer la peticion a la pagina del QR
    const response = await fetch(qrUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(6000),
    })

    if (!response.ok) {
      return NextResponse.json(
        {
          activo: false,
          mensaje: `Error HTTP: ${response.status}`,
          nombre: "",
          accessType: null
        },
        { status: 200 }
      )
    }

    const html = await response.text()

    // Extraer nombre, numero de control, carrera y estatus de la credencial
    const { nombre, numeroControl, carrera, estatus, activo } = extraerDatosCredencial(html)

    // Sin nombre y numero de control no se puede verificar la identidad
    if (!nombre || !numeroControl) {
      return NextResponse.json({
        activo: false,
        mensaje: "No se pudo verificar el nombre del alumno en la credencial.",
        nombre: "",
        accessType: null
      })
    }

    if (!activo) {
      return NextResponse.json({
        activo: false,
        mensaje: `Alumno no activo${estatus ? ` (${estatus})` : ""}.`,
        nombre,
        numeroControl,
        accessType: null
      })
    }

    // Verificar estado actual del estudiante (si ya esta adentro o afuera)
    const isCurrentlyInside = await verificarEstadoEstudiante(numeroControl)

    // Si es null, es primera vez - es entrada
    // Si es true (esta adentro), es salida
    // Si es false (esta afuera), es entrada
    const isEntry = isCurrentlyInside === null || isCurrentlyInside === false

    // Registrar el acceso
    const tiempoRespuestaMs = Math.round(performance.now() - startedAt)
    const { accessType } = await registrarAcceso(numeroControl, nombre, carrera, qrUrl, isEntry, tiempoRespuestaMs)

    // Generar mensaje segun tipo de acceso
    const mensaje = isEntry
      ? `¡Bienvenido, ${nombre}! Acceso autorizado - ${estatus}`
      : `¡Que tenga buen dia, ${nombre}! Salida registrada`

    return NextResponse.json({
      activo: true,
      mensaje,
      nombre,
      numeroControl,
      accessType,
      carrera
    })

  } catch (error) {
    console.error("[v0] Error validating student:", error)

    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json(
        { activo: false, mensaje: "Timeout: La pagina no respondio", nombre: "", accessType: null },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { activo: false, mensaje: "Error al conectar con el servidor", nombre: "", accessType: null },
      { status: 200 }
    )
  }
}
