import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Crear cliente de Supabase con service role para bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Palabras clave que confirman que el alumno está activo
const PALABRAS_CLAVE_ACTIVO = [
  "ACTIVO", "ACTIVO IRREGULAR", "ACTIVO REGULAR",
  "Estatus: Activo", "Dado de Alta", "DADO DE ALTA", "activo",
]

// Lista negra de palabras que no son nombres
const NO_ES_NOMBRE = new Set([
  'ESTUDIANTE', 'EGRESADO', 'DOCENTE', 'PERSONAL', 'ADMINISTRATIVO',
  'ACTIVO', 'INACTIVO', 'REGULAR', 'IRREGULAR',
  'ACTIVO IRREGULAR', 'ACTIVO REGULAR', 'INACTIVO IRREGULAR',
  'TECNM', 'ITM', 'MORELIA', 'IMSS',
])

function limpiarTexto(texto: string): string {
  const tabla: Record<string, string> = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n',
    'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u',
    'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u',
    'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ü': 'U', 'Ñ': 'N',
    'À': 'A', 'È': 'E', 'Ì': 'I', 'Ò': 'O', 'Ù': 'U',
    'Â': 'A', 'Ê': 'E', 'Î': 'I', 'Ô': 'O', 'Û': 'U',
  }
  return texto.split('').map(c => tabla[c] || c).join('')
}

function esPalabraNombre(palabra: string): boolean {
  return (
    palabra.length >= 2 &&
    /^[A-Za-záéíóúÁÉÍÓÚñÑüÜ]+$/.test(palabra) &&
    palabra === palabra.toUpperCase()
  )
}

function extraerNumeroControl(url: string): string {
  // Intentar extraer el numero de control de la URL
  const match = url.match(/\/(\d{8,})/) || url.match(/id=(\d{8,})/) || url.match(/control=(\d{8,})/)
  return match ? match[1] : ""
}

function extraerCarrera(html: string): string {
  // Buscar patrones comunes de carrera
  const patrones = [
    /INGENIERIA\s+(?:EN\s+)?[A-ZÁÉÍÓÚÑ\s]+/gi,
    /LICENCIATURA\s+EN\s+[A-ZÁÉÍÓÚÑ\s]+/gi,
    /MAESTRIA\s+EN\s+[A-ZÁÉÍÓÚÑ\s]+/gi,
  ]

  for (const patron of patrones) {
    const match = html.match(patron)
    if (match) {
      return match[0].trim()
    }
  }

  return ""
}

function extraerNombreITM(html: string): string {
  // Extraer solo el texto visible del HTML
  const textoLimpio = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')

  // Dividir en lineas y limpiar
  const lineas = textoLimpio.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 2)

  // Buscar el indice donde aparece "ACTIVO" o "INACTIVO"
  let idxEstatus = -1
  for (let i = 0; i < lineas.length; i++) {
    if (lineas[i].toUpperCase().includes('ACTIVO') || lineas[i].toUpperCase().includes('INACTIVO')) {
      idxEstatus = i
      break
    }
  }

  const inicio = idxEstatus !== -1 ? idxEstatus + 1 : 0

  // Buscar el nombre en las lineas posteriores al estatus
  for (let i = inicio; i < Math.min(inicio + 20, lineas.length); i++) {
    const txt = lineas[i]

    // STOP: numero de control (texto puramente numerico)
    if (/^\d+$/.test(txt.trim())) break

    // Saltar lista negra
    if (NO_ES_NOMBRE.has(txt.trim().toUpperCase())) continue

    // Saltar si contiene digitos
    if (/\d/.test(txt)) continue

    // Saltar caracteres especiales
    if (/[#@:\-\+\(\)\[\]\{\}\\\/\.\,\"\']/g.test(txt)) continue

    // El nombre debe tener entre 2 y 6 palabras, todas MAYUSCULAS
    const palabras = txt.trim().split(/\s+/)
    if (palabras.length >= 2 && palabras.length <= 6 && palabras.every(esPalabraNombre)) {
      return txt.trim()
    }
  }

  return ""
}

async function registrarAcceso(
  controlNumber: string,
  studentName: string,
  carrera: string,
  isEntry: boolean
): Promise<{ accessType: "entrada" | "salida" }> {
  const accessType = isEntry ? "entrada" : "salida"

  // Registrar en la bitacora
  await supabaseAdmin.from("access_logs").insert({
    control_number: controlNumber,
    student_name: studentName,
    carrera: carrera || null,
    access_type: accessType,
    access_time: new Date().toISOString(),
  })

  // Actualizar el estado del estudiante
  await supabaseAdmin.from("student_status").upsert({
    control_number: controlNumber,
    student_name: studentName,
    carrera: carrera || null,
    is_inside: isEntry,
    last_access: new Date().toISOString(),
  }, {
    onConflict: "control_number"
  })

  return { accessType }
}

async function verificarEstadoEstudiante(controlNumber: string): Promise<boolean | null> {
  const { data } = await supabaseAdmin
    .from("student_status")
    .select("is_inside")
    .eq("control_number", controlNumber)
    .single()

  return data?.is_inside ?? null
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL no proporcionada" },
        { status: 400 }
      )
    }

    // Validar que sea una URL valida
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: "URL invalida" },
        { status: 400 }
      )
    }

    // Extraer numero de control de la URL
    const controlNumber = extraerNumeroControl(url)

    // Hacer la peticion a la pagina del QR
    const response = await fetch(url, {
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

    // Extraer nombre y carrera
    const nombreCrudo = extraerNombreITM(html)
    const nombre = nombreCrudo ? limpiarTexto(nombreCrudo) : ""
    const carrera = extraerCarrera(html)

    // Verificar estatus activo
    let activo = false
    let estatusEncontrado = ""
    
    for (const palabra of PALABRAS_CLAVE_ACTIVO) {
      if (html.includes(palabra)) {
        activo = true
        estatusEncontrado = palabra
        break
      }
    }

    if (!activo) {
      return NextResponse.json({
        activo: false,
        mensaje: "No se encontro estatus activo en la pagina.",
        nombre,
        accessType: null
      })
    }

    // Verificar estado actual del estudiante (si ya esta adentro o afuera)
    const uniqueId = controlNumber || nombre || url
    const isCurrentlyInside = await verificarEstadoEstudiante(uniqueId)
    
    // Si es null, es primera vez - es entrada
    // Si es true (esta adentro), es salida
    // Si es false (esta afuera), es entrada
    const isEntry = isCurrentlyInside === null || isCurrentlyInside === false

    // Registrar el acceso
    const { accessType } = await registrarAcceso(uniqueId, nombre, carrera, isEntry)

    // Generar mensaje segun tipo de acceso
    const mensaje = isEntry 
      ? `¡Bienvenido! Acceso autorizado - ${estatusEncontrado}`
      : `¡Que tenga buen dia! Salida registrada`

    return NextResponse.json({
      activo: true,
      mensaje,
      nombre,
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
