const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const axios = require("axios");

initializeApp();
const db = getFirestore();

const SPORTSDB_API_KEY = defineSecret("SPORTSDB_API_KEY");
const LIGA_MX_ID = 4350;
const TEMPORADA_ACTUAL = "2026-2027";
const ADMIN_UID = "CNTWR8yNC0SIaRtELk8aW9eldvC2";

/**
 * Trae los resultados actuales de los partidos de Liga MX desde TheSportsDB
 * y actualiza el campo "resultado" y "estado" de cada partido en la jornada activa.
 *
 * Regla de negocio: solo actualiza partidos que ya tienen resultado "FT" en la API
 * y que aún no tenían resultado guardado localmente (evita pisar datos ya calificados).
 */
async function actualizarResultadosJornadaActiva() {
  // 1. Busca la jornada que esté "en_curso"
  const jornadasSnap = await db
    .collection("jornadas")
    .where("estado", "==", "en_curso")
    .limit(1)
    .get();

  if (jornadasSnap.empty) {
    console.log("No hay jornada en curso, nada que actualizar.");
    return { actualizados: 0 };
  }

  const jornadaDoc = jornadasSnap.docs[0];
  const jornada = jornadaDoc.data();

  // 2. Pregunta a la API todos los partidos de la temporada (una sola llamada)
  const respuesta = await axios.get(
    "https://www.thesportsdb.com/api/v1/json/" + SPORTSDB_API_KEY.value() + "/eventsseason.php",
    {
      params: {
        id: LIGA_MX_ID,
        s: TEMPORADA_ACTUAL,
      },
    }
  );

  const todosLosPartidos = respuesta.data.events || [];

  // 3. Filtra solo los partidos de la jornada activa por número de ronda
  const partidosApi = todosLosPartidos.filter(
    (p) => parseInt(p.intRound, 10) === jornada.numero
  );

  let actualizados = 0;

  // 4. Compara cada partido guardado con lo que trae la API, por nombres de equipos
  const partidosActualizados = jornada.partidos.map((partidoLocal) => {
    if (partidoLocal.resultado) return partidoLocal; // ya calificado, no tocar

    const partidoApi = partidosApi.find(
      (p) =>
        p.strHomeTeam.toLowerCase().includes(partidoLocal.equipo_local.toLowerCase()) ||
        partidoLocal.equipo_local.toLowerCase().includes(p.strHomeTeam.toLowerCase())
    );

    if (!partidoApi) return partidoLocal; // No se encontró match, se deja igual

    if (partidoApi.strStatus !== "FT") return partidoLocal; // Aún no termina, no tocar

    const golesLocal = parseInt(partidoApi.intHomeScore, 10);
    const golesVisitante = parseInt(partidoApi.intAwayScore, 10);

    let resultado = "empate";
    if (golesLocal > golesVisitante) resultado = "local";
    if (golesVisitante > golesLocal) resultado = "visitante";

    actualizados++;
    return {
      ...partidoLocal,
      resultado,
      estado: "finalizado",
    };
  });

  // 5. Guarda los partidos actualizados de vuelta en Firestore
  await jornadaDoc.ref.update({ partidos: partidosActualizados });

  console.log(`Jornada ${jornada.numero}: ${actualizados} partidos actualizados.`);
  return { actualizados };
}

// ============================================================================
// FUNCIÓN PROGRAMADA: corre automáticamente cada hora
// ============================================================================
exports.actualizarResultadosProgramado = onSchedule(
  {
    schedule: "every 60 minutes",
    secrets: [SPORTSDB_API_KEY],
    timeZone: "America/Mexico_City",
  },
  async () => {
    await actualizarResultadosJornadaActiva();
  }
);

// ============================================================================
// FUNCIÓN MANUAL: para que el admin la dispare desde el panel cuando quiera
// ============================================================================
exports.actualizarResultadosManual = onRequest(
  { secrets: [SPORTSDB_API_KEY], cors: true },
  async (req, res) => {
    try {
      const resultado = await actualizarResultadosJornadaActiva();
      res.status(200).json({ ok: true, ...resultado });
    } catch (error) {
      console.error(error);
      res.status(500).json({ ok: false, error: error.message });
    }
  }
);

// ============================================================================
// CREAR JORNADA DESDE API: jala partidos de TheSportsDB y crea documento
// ============================================================================
exports.crearJornadaDesdeAPI = onRequest(
  { secrets: [SPORTSDB_API_KEY], cors: true },
  async (req, res) => {
    try {
      // Obtener el token del header Authorization
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ ok: false, error: "No autenticado" });
      }

      const token = authHeader.substring(7);

      // Verificar el token con Firebase Admin SDK
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(token);
      } catch (err) {
        return res.status(401).json({ ok: false, error: "Token inválido" });
      }

      const uid = decodedToken.uid;

      // Protección: solo el admin puede crear jornadas
      if (uid !== ADMIN_UID) {
        return res.status(403).json({ ok: false, error: "Solo el admin puede crear jornadas" });
      }

      const numeroJornada = req.body.numeroJornada;

      if (!numeroJornada || numeroJornada < 1 || numeroJornada > 17) {
        return res.status(400).json({ ok: false, error: "Número de jornada debe estar entre 1 y 17" });
      }

      // Verificar que la jornada no exista ya
      const jornadadoc = await db.collection("jornadas").doc(`jornada_${numeroJornada}`).get();
      if (jornadadoc.exists) {
        return res.status(409).json({ ok: false, error: `La jornada ${numeroJornada} ya existe` });
      }

      // Traer partidos de TheSportsDB
      const { data } = await axios.get(
        "https://www.thesportsdb.com/api/v1/json/" + SPORTSDB_API_KEY.value() + "/eventsseason.php",
        { params: { id: LIGA_MX_ID, s: TEMPORADA_ACTUAL } }
      );

      const todosLosPartidos = data.events || [];
      const partidosDeLaJornada = todosLosPartidos.filter(
        (p) => parseInt(p.intRound, 10) === numeroJornada
      );

      if (partidosDeLaJornada.length === 0) {
        return res.status(404).json({ ok: false, error: `No hay partidos para la jornada ${numeroJornada}` });
      }

      // Transformar partidos al formato de Firestore
      const partidos = partidosDeLaJornada.map((p, i) => ({
        id: i + 1,
        equipo_local: p.strHomeTeam,
        equipo_visitante: p.strAwayTeam,
        fecha: p.dateEvent,
        hora: p.strTimeLocal,
        resultado: null,
        estado: "programado",
      }));

      // Guardar jornada en Firestore
      await db.collection("jornadas").doc(`jornada_${numeroJornada}`).set({
        numero: numeroJornada,
        estado: "borrador",
        partidos: partidos,
        creadaEn: new Date().toISOString(),
      });

      return res.status(200).json({
        ok: true,
        numeroJornada,
        partidos: partidos.length,
        mensaje: `Jornada ${numeroJornada} creada con ${partidos.length} partidos`,
      });
    } catch (error) {
      console.error("Error en crearJornadaDesdeAPI:", error);
      return res.status(500).json({ ok: false, error: error.message || "Error desconocido" });
    }
  }
);