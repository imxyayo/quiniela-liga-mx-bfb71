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
 * ============================================================================
 * OBTENER PARTIDOS DE UNA JORNADA ESPECÍFICA
 * ============================================================================
 *
 * Usamos eventsround.php porque necesitamos pedir directamente:
 *
 * Jornada 4
 * Jornada 5
 * Jornada 6
 * etc.
 *
 * TheSportsDB utiliza:
 *
 * id = liga
 * r  = número de jornada
 * s  = temporada
 */
async function obtenerPartidosJornada(numeroJornada) {
  console.log(
    `Buscando Jornada ${numeroJornada} de la temporada ${TEMPORADA_ACTUAL}...`
  );

  const respuesta = await axios.get(
    "https://www.thesportsdb.com/api/v1/json/" +
      SPORTSDB_API_KEY.value() +
      "/eventsround.php",
    {
      params: {
        id: LIGA_MX_ID,
        r: numeroJornada,
        s: TEMPORADA_ACTUAL,
      },
    }
  );

  const eventos = respuesta.data.events || [];

  console.log(
    `TheSportsDB devolvió ${eventos.length} partidos para la Jornada ${numeroJornada}.`
  );

  return eventos;
}

/**
 * ============================================================================
 * ACTUALIZAR RESULTADOS DE LA JORNADA ACTIVA
 * ============================================================================
 *
 * Busca la jornada "en_curso".
 *
 * Después consulta TheSportsDB para esa jornada.
 *
 * Solo actualiza partidos que ya terminaron (FT).
 */
async function actualizarResultadosJornadaActiva() {
  const jornadasSnap = await db
    .collection("jornadas")
    .where("estado", "==", "en_curso")
    .limit(1)
    .get();

  if (jornadasSnap.empty) {
    console.log("No hay jornada en curso, nada que actualizar.");

    return {
      actualizados: 0,
    };
  }

  const jornadaDoc = jornadasSnap.docs[0];
  const jornada = jornadaDoc.data();

  console.log(`Actualizando Jornada ${jornada.numero}...`);

  // Obtener únicamente los partidos de esta jornada
  const partidosApi = await obtenerPartidosJornada(jornada.numero);

  if (partidosApi.length === 0) {
    console.log(
      `TheSportsDB no devolvió partidos para la Jornada ${jornada.numero}.`
    );

    return {
      actualizados: 0,
    };
  }

  let actualizados = 0;

  const partidosActualizados = jornada.partidos.map((partidoLocal) => {
    // Si ya tiene resultado, no modificarlo
    if (partidoLocal.resultado) {
      return partidoLocal;
    }

    // Buscar el partido correspondiente
    const partidoApi = partidosApi.find((p) => {
      const localApi = (p.strHomeTeam || "").toLowerCase();
      const visitanteApi = (p.strAwayTeam || "").toLowerCase();

      const localFirestore = (
        partidoLocal.equipo_local || ""
      ).toLowerCase();

      const visitanteFirestore = (
        partidoLocal.equipo_visitante || ""
      ).toLowerCase();

      const coincideLocal =
        localApi.includes(localFirestore) ||
        localFirestore.includes(localApi);

      const coincideVisitante =
        visitanteApi.includes(visitanteFirestore) ||
        visitanteFirestore.includes(visitanteApi);

      return coincideLocal && coincideVisitante;
    });

    if (!partidoApi) {
      console.log(
        `No se encontró en API: ${partidoLocal.equipo_local} vs ${partidoLocal.equipo_visitante}`
      );

      return partidoLocal;
    }

    // Si todavía no termina, no tocarlo
    if (partidoApi.strStatus !== "FT") {
      return partidoLocal;
    }

    const golesLocal = parseInt(partidoApi.intHomeScore, 10);
    const golesVisitante = parseInt(partidoApi.intAwayScore, 10);

    let resultado = "empate";

    if (golesLocal > golesVisitante) {
      resultado = "local";
    }

    if (golesVisitante > golesLocal) {
      resultado = "visitante";
    }

    actualizados++;

    console.log(
      `Resultado actualizado: ${partidoLocal.equipo_local} vs ${partidoLocal.equipo_visitante} = ${resultado}`
    );

    return {
      ...partidoLocal,
      resultado,
      estado: "finalizado",
    };
  });

  await jornadaDoc.ref.update({
    partidos: partidosActualizados,
  });

  console.log(
    `Jornada ${jornada.numero}: ${actualizados} partidos actualizados.`
  );

  return {
    actualizados,
  };
}

/**
 * ============================================================================
 * FUNCIÓN PROGRAMADA
 * ============================================================================
 *
 * Se ejecuta automáticamente cada hora.
 */
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

/**
 * ============================================================================
 * FUNCIÓN MANUAL
 * ============================================================================
 *
 * Sirve para probar manualmente la actualización de resultados.
 */
exports.actualizarResultadosManual = onRequest(
  {
    secrets: [SPORTSDB_API_KEY],
    cors: true,
  },
  async (req, res) => {
    try {
      const resultado = await actualizarResultadosJornadaActiva();

      return res.status(200).json({
        ok: true,
        ...resultado,
      });
    } catch (error) {
      console.error("Error actualizando resultados:", error);

      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  }
);

/**
 * ============================================================================
 * CREAR JORNADA DESDE API
 * ============================================================================
 *
 * Puede recibir:
 *
 * {
 *   numeroJornada: 4,
 *   activarInmediatamente: true
 * }
 *
 * Si activarInmediatamente = true:
 *
 * estado = "en_curso"
 *
 * Si no:
 *
 * estado = "borrador"
 */
exports.crearJornadaDesdeAPI = onRequest(
  {
    secrets: [SPORTSDB_API_KEY],
    cors: true,
  },
  async (req, res) => {
    try {
      /**
       * ------------------------------------------------------------------------
       * AUTENTICACIÓN
       * ------------------------------------------------------------------------
       */

      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          ok: false,
          error: "No autenticado",
        });
      }

      const token = authHeader.substring(7);

      let decodedToken;

      try {
        decodedToken = await admin.auth().verifyIdToken(token);
      } catch (error) {
        console.error("Token inválido:", error);

        return res.status(401).json({
          ok: false,
          error: "Token inválido",
        });
      }

      const uid = decodedToken.uid;

      /**
       * ------------------------------------------------------------------------
       * SOLO ADMIN
       * ------------------------------------------------------------------------
       */

      if (uid !== ADMIN_UID) {
        return res.status(403).json({
          ok: false,
          error: "Solo el admin puede crear jornadas",
        });
      }

      /**
       * ------------------------------------------------------------------------
       * DATOS RECIBIDOS
       * ------------------------------------------------------------------------
       */

      const numeroJornada = Number(req.body.numeroJornada);

      const activarInmediatamente =
        req.body.activarInmediatamente === true;

      if (
        !Number.isInteger(numeroJornada) ||
        numeroJornada < 1 ||
        numeroJornada > 17
      ) {
        return res.status(400).json({
          ok: false,
          error: "Número de jornada debe estar entre 1 y 17",
        });
      }

      console.log(
        `Solicitud para crear Jornada ${numeroJornada}.`
      );

      /**
       * ------------------------------------------------------------------------
       * VERIFICAR SI YA EXISTE
       * ------------------------------------------------------------------------
       */

      const jornadaRef = db
        .collection("jornadas")
        .doc(`jornada_${numeroJornada}`);

      const jornadaDoc = await jornadaRef.get();

      if (jornadaDoc.exists) {
        return res.status(409).json({
          ok: false,
          error: `La jornada ${numeroJornada} ya existe`,
        });
      }

      /**
       * ------------------------------------------------------------------------
       * OBTENER PARTIDOS DE LA JORNADA
       * ------------------------------------------------------------------------
       */

      const partidosDeLaJornada =
        await obtenerPartidosJornada(numeroJornada);

      if (partidosDeLaJornada.length === 0) {
        return res.status(404).json({
          ok: false,
          error:
            `TheSportsDB no tiene partidos disponibles para la Jornada ${numeroJornada} ` +
            `de la temporada ${TEMPORADA_ACTUAL}.`,
        });
      }

      /**
       * ------------------------------------------------------------------------
       * TRANSFORMAR PARTIDOS
       * ------------------------------------------------------------------------
       */

      const partidos = partidosDeLaJornada.map((p, index) => ({
        id: index + 1,

        equipo_local: p.strHomeTeam || "",

        equipo_visitante: p.strAwayTeam || "",

        fecha: p.dateEvent || null,

        hora: p.strTimeLocal || p.strTime || null,

        resultado: null,

        estado: "programado",
      }));

      /**
       * ------------------------------------------------------------------------
       * GUARDAR JORNADA
       * ------------------------------------------------------------------------
       */

      const estadoInicial = activarInmediatamente
        ? "en_curso"
        : "borrador";

      await jornadaRef.set({
        numero: numeroJornada,

        estado: estadoInicial,

        partidos,

        creadaEn: new Date().toISOString(),
      });

      console.log(
        `Jornada ${numeroJornada} creada correctamente con ${partidos.length} partidos.`
      );

      /**
       * ------------------------------------------------------------------------
       * RESPUESTA
       * ------------------------------------------------------------------------
       */

      return res.status(200).json({
        ok: true,

        numeroJornada,

        partidos: partidos.length,

        estado: estadoInicial,

        mensaje: activarInmediatamente
          ? `Jornada ${numeroJornada} creada y publicada con ${partidos.length} partidos`
          : `Jornada ${numeroJornada} creada con ${partidos.length} partidos`,
      });
    } catch (error) {
      console.error(
        "Error en crearJornadaDesdeAPI:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          error.message ||
          "Error desconocido",
      });
    }
  }
);