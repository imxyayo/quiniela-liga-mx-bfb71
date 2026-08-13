import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../services/firebase";
import "./CerrarJornada.css";

// Cuota que paga cada persona por jornada. El premio total no es fijo:
// se calcula como (CUOTA_POR_PERSONA - COMISION_ADMIN) * cuántos mandaron
// predicción esa semana. La comisión se queda con el admin, el resto
// se reparte entre los ganadores.
const CUOTA_POR_PERSONA = 100;
const COMISION_ADMIN = 10;
const APORTE_AL_BOTE = CUOTA_POR_PERSONA - COMISION_ADMIN;
const ULTIMA_JORNADA_TEMPORADA = 17;

const FUNCTION_URL =
  "https://crearjornadadesdeapi-faiy4zqaaq-uc.a.run.app";

function calcularAciertos(partidos, predicciones) {
  let aciertos = 0;
  let fallos = 0;
  partidos.forEach((partido) => {
    const finalizado = partido.estado === "finalizado" && partido.resultado;
    if (!finalizado) return;
    const prediccion = predicciones.find((p) => p.id_partido === partido.id);
    if (prediccion && prediccion.prediccion === partido.resultado) {
      aciertos += 1;
    } else {
      fallos += 1;
    }
  });
  return { aciertos, fallos };
}

// Llama a la misma Cloud Function que usa CrearJornada.jsx, para crear
// automáticamente la siguiente jornada en cuanto se cierra la actual.
async function crearSiguienteJornada(numeroSiguiente) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("No estás autenticado");
  }
  const token = await currentUser.getIdToken(true);

  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      numeroJornada: numeroSiguiente,
      activarInmediatamente: true,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error desconocido al crear la siguiente jornada");
  }

  return data;
}

export default function CerrarJornada() {
  const [jornada, setJornada] = useState(null);
  const [jornadaId, setJornadaId] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [forzar, setForzar] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const cargar = async () => {
      const q = query(collection(db, "jornadas"), where("estado", "==", "en_curso"));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        setJornadaId(d.id);
        setJornada(d.data());
      }
      setCargando(false);
    };
    cargar();
  }, []);

  const handleCerrar = async () => {
    setError("");
    setProcesando(true);
    try {
      let snap;
      try {
        const q = query(
          collection(db, "predicciones"),
          where("numero_jornada", "==", jornada.numero)
        );
        snap = await getDocs(q);
      } catch (err) {
        console.error("[cerrar] Falló leyendo predicciones:", err.code, err);
        throw new Error("No se pudieron leer las predicciones (revisa reglas de 'predicciones').");
      }

      if (snap.empty) {
        setError("Nadie ha enviado predicciones para esta jornada.");
        setProcesando(false);
        return;
      }

      const batch = writeBatch(db);
      let mejorAciertos = -1;
      const filas = [];

      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const { aciertos, fallos } = calcularAciertos(
          jornada.partidos,
          data.predicciones || []
        );
        batch.update(doc(db, "predicciones", docSnap.id), {
          resultado: { aciertos, fallos },
        });
        filas.push({ uid: data.uid, aciertos });
        if (aciertos > mejorAciertos) mejorAciertos = aciertos;
      });

      // Premio dinámico: (cuota - comisión del admin) * cuántos mandaron
      // predicción esta jornada (no depende de los 30 registrados, solo
      // de quien sí participó).
      const numParticipantes = filas.length;
      const premioTotal = APORTE_AL_BOTE * numParticipantes;

      const ganadores = filas.filter((f) => f.aciertos === mejorAciertos);
      const premioIndividual =
        Math.round((premioTotal / ganadores.length) * 100) / 100;

      let nombresPorUid = {};
      try {
        const usuariosSnap = await getDocs(collection(db, "usuarios"));
        usuariosSnap.docs.forEach((u) => {
          nombresPorUid[u.id] = u.data().nombre || "Jugador";
        });
      } catch (err) {
        console.error("[cerrar] Falló leyendo usuarios:", err.code, err);
        throw new Error("No se pudieron leer los perfiles de usuario (revisa reglas de 'usuarios').");
      }

      const ganadoresConNombre = ganadores.map((g) => ({
        ...g,
        nombre: nombresPorUid[g.uid] || "Jugador",
      }));

      batch.update(doc(db, "jornadas", jornadaId), {
        estado: "cerrada",
        cerradaEn: serverTimestamp(),
        ganadores: ganadoresConNombre,
        premioIndividual,
        premioTotal,
        numParticipantes,
        cuotaPorPersona: CUOTA_POR_PERSONA,
        comisionAdmin: COMISION_ADMIN,
      });

      try {
        await batch.commit();
      } catch (err) {
        console.error("[cerrar] Falló el batch.commit:", err.code, err);
        throw new Error("El batch de escritura falló (revisa reglas de 'predicciones' o 'jornadas').");
      }

      // Jornada cerrada con éxito. Ahora, sin bloquear lo anterior, intenta
      // crear automáticamente la siguiente y dejarla en_curso.
      let siguienteInfo = null;
      const numeroSiguiente = jornada.numero + 1;

      if (numeroSiguiente > ULTIMA_JORNADA_TEMPORADA) {
        siguienteInfo = {
          ok: true,
          mensaje: "Era la última jornada de la temporada. No se crea una siguiente.",
        };
      } else {
        try {
          const data = await crearSiguienteJornada(numeroSiguiente);
          siguienteInfo = {
            ok: true,
            mensaje: `Jornada ${numeroSiguiente} creada y publicada con ${data.partidos} partidos.`,
          };
        } catch (err) {
          console.error("[cerrar] No se pudo crear la siguiente jornada:", err);
          siguienteInfo = {
            ok: false,
            mensaje:
              `No se pudo crear la jornada ${numeroSiguiente} automáticamente (${err.message}). ` +
              `Créala manualmente desde "Crear jornada" cuando esté disponible.`,
          };
        }
      }

      setResultado({
        ganadores: ganadoresConNombre,
        premioIndividual,
        premioTotal,
        numParticipantes,
        siguienteInfo,
      });
    } catch (err) {
      console.error("Error cerrando jornada:", err);
      setError(err.message || "Ocurrió un error al cerrar la jornada. Intenta de nuevo.");
    } finally {
      setProcesando(false);
    }
  };

  if (cargando) {
    return <p className="cj-cargando">Buscando jornada en curso…</p>;
  }

  if (!jornada) {
    return <p className="cj-cargando">No hay jornada en curso para cerrar.</p>;
  }

  if (resultado) {
    return (
      <div className="cj-resultado">
        <h3>Jornada {jornada.numero} cerrada</h3>
        <p className="cj-resultado-label">
          {resultado.ganadores.length > 1 ? "Ganadores" : "Ganador"}
        </p>
        <p className="cj-participantes">
          {resultado.numParticipantes} participantes · $
          {resultado.premioTotal.toLocaleString("es-MX")} repartidos
        </p>
        <ul className="cj-ganadores">
          {resultado.ganadores.map((g) => (
            <li key={g.uid}>
              <span className="cj-ganador-nombre">{g.nombre}</span>
              <span className="cj-ganador-aciertos">{g.aciertos} aciertos</span>
              <span className="cj-ganador-premio">
                ${resultado.premioIndividual.toLocaleString("es-MX")}
              </span>
            </li>
          ))}
        </ul>

        {resultado.siguienteInfo && (
          <p
            className={
              resultado.siguienteInfo.ok
                ? "cj-siguiente cj-siguiente-ok"
                : "cj-siguiente cj-siguiente-error"
            }
          >
            {resultado.siguienteInfo.mensaje}
          </p>
        )}
      </div>
    );
  }

  const partidosFinalizados = jornada.partidos.filter(
    (p) => p.estado === "finalizado" && p.resultado
  ).length;
  const totalPartidos = jornada.partidos.length;
  const todosFinalizados = partidosFinalizados === totalPartidos;

  return (
    <div className="cj-card">
      <div className="cj-info">
        <span className="cj-eyebrow">Jornada {jornada.numero}</span>
        <p className="cj-progreso">
          {partidosFinalizados} de {totalPartidos} partidos finalizados
        </p>
      </div>

      {!todosFinalizados && (
        <div className="cj-advertencia">
          Todavía hay partidos sin resultado. Cerrar ahora puede dejar aciertos
          incompletos para todos.
          <label className="cj-forzar">
            <input
              type="checkbox"
              checked={forzar}
              onChange={(e) => setForzar(e.target.checked)}
            />
            Entiendo, cerrar de todas formas
          </label>
        </div>
      )}

      {error && <div className="cj-error">{error}</div>}

      <button
        className="cj-btn-cerrar"
        onClick={handleCerrar}
        disabled={procesando || (!todosFinalizados && !forzar)}
      >
        {procesando ? "Cerrando…" : "Cerrar jornada y calcular ganador"}
      </button>
    </div>
  );
}