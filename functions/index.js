const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");

const openaiApiKey = defineSecret("OPENAI_API_KEY");

const AREA_KEYS = ["grupo", "caja", "taller", "redes"];

function setCors(req, res) {
  const origin = req.headers.origin || "";
  const allowedOrigins = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "https://capital-bikes.web.app",
    "https://capital-bikes.firebaseapp.com",
  ];
  if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

async function proxyLoyverse(req, res, targetPath) {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const allowedMethods = targetPath === "items" || targetPath === "customers" ? ["GET"] : targetPath === "receipts" ? ["POST"] : [];
  if (!allowedMethods.includes(req.method)) {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }

  const token = String(req.headers.authorization || "").trim();
  if (!token.toLowerCase().startsWith("bearer ")) {
    res.status(401).json({ error: "Falta Authorization Bearer token" });
    return;
  }

  try {
    const url = new URL(`https://api.loyverse.com/v1.0/${targetPath}`);
    for (const [key, value] of Object.entries(req.query || {})) {
      if (Array.isArray(value)) {
        value.forEach(item => url.searchParams.append(key, String(item)));
      } else if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const loyverseRes = await fetch(url, {
      method: req.method,
      headers: {
        Authorization: token,
        ...(req.method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      ...(req.method === "POST" ? { body: JSON.stringify(req.body || {}) } : {}),
    });

    const text = await loyverseRes.text();
    res.status(loyverseRes.status);
    res.set("Content-Type", loyverseRes.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (error) {
    console.error("loyverse proxy error", error);
    res.status(502).json({
      error: "No se pudo conectar con Loyverse",
      detail: error?.message || "Error desconocido",
    });
  }
}

exports.loyverseItems = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  (req, res) => proxyLoyverse(req, res, "items")
);

exports.loyverseReceipts = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  (req, res) => proxyLoyverse(req, res, "receipts")
);

exports.loyverseCustomers = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  (req, res) => proxyLoyverse(req, res, "customers")
);

function safeJson(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

function normalizeMessages(data) {
  const output = {};
  AREA_KEYS.forEach(key => {
    output[key] = typeof data?.[key] === "string" ? data[key].trim() : "";
  });
  output.dudas = Array.isArray(data?.dudas)
    ? data.dudas.map(item => String(item).trim()).filter(Boolean).slice(0, 6)
    : [];
  return output;
}

exports.organizarMensajes = onRequest(
  {
    region: "us-central1",
    secrets: [openaiApiKey],
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (req, res) => {
    setCors(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Metodo no permitido" });
      return;
    }

    const rawMessage = String(req.body?.message || "").trim();
    const tone = String(req.body?.tone || "amable").trim();
    const team = Array.isArray(req.body?.team) ? req.body.team : [];

    if (!rawMessage) {
      res.status(400).json({ error: "Falta el mensaje para organizar" });
      return;
    }
    if (rawMessage.length > 6000) {
      res.status(400).json({ error: "El mensaje es demasiado largo. Maximo 6000 caracteres." });
      return;
    }

    try {
      const client = new OpenAI({ apiKey: openaiApiKey.value() });
      const teamContext = team
        .map(member => `${member.name || ""}${member.role ? ` (${member.role})` : ""}`.trim())
        .filter(Boolean)
        .join(", ");

      const response = await client.responses.create({
        model: "gpt-5-mini",
        instructions: [
          "Eres el agente operativo de Capital Wo-Man Bikes.",
          "Tu tarea es leer notas desordenadas de WhatsApp o del dia a dia, entender el contexto real y convertirlo en mensajes claros para el equipo.",
          "Analiza antes de responder: identifica personas, prioridades, dependencias, pagos, trabajos de taller, contenido para redes y dudas.",
          "No te limites a clasificar frases: interpreta, resume, une ideas repetidas, elimina ruido y redacta mensajes accionables.",
          "Si el mensaje bruto viene mezclado, separa lo que debe ir en privado a cada area y lo que debe ir al grupo general.",
          "Divide la informacion en cuatro destinos: grupo, caja, taller y redes.",
          "Caja incluye pagos, abonos, cobros, facturas, transferencias, recibos y cierre.",
          "Taller incluye bicicletas, mecanica, repuestos, diagnosticos, mantenimientos, entregas y tiempos.",
          "Redes incluye fotos, videos, historias, reels, publicaciones, testimonios y contenido.",
          "Grupo incluye coordinacion general, horarios, prioridades compartidas y avisos para todos.",
          "Cada mensaje debe sonar listo para enviar por WhatsApp: natural, ordenado, concreto y sin texto de mas.",
          "Usa bullets solo cuando haya varias acciones. Si hay una sola accion, redacta corto.",
          "Incluye responsables cuando sean claros. Si no son claros, pide confirmacion en dudas.",
          "No dupliques toda la informacion en grupo si ya va detallada en caja, taller o redes; el grupo debe coordinar y priorizar.",
          "Si algo no esta claro, no lo inventes: agregalo en dudas.",
          "Usa espanol natural de Colombia, tono humano, directo y respetuoso.",
          "Devuelve solo JSON valido, sin markdown.",
        ].join("\n"),
        input: JSON.stringify({
          tono: tone,
          equipo: teamContext || "Sergio: taller, Cindy: caja/tienda, Julieth: administracion",
          mensaje: rawMessage,
          formato_obligatorio: {
            grupo: "mensaje listo para enviar al grupo general",
            caja: "mensaje listo para enviar a caja",
            taller: "mensaje listo para enviar a taller",
            redes: "mensaje listo para enviar a redes",
            dudas: ["puntos que necesitan aclaracion"],
          },
        }),
      });

      const parsed = normalizeMessages(safeJson(response.output_text));
      res.status(200).json(parsed);
    } catch (error) {
      console.error("organizarMensajes error", error);
      res.status(500).json({
        error: "No se pudo organizar con IA",
        detail: error?.message || "Error desconocido",
      });
    }
  }
);
