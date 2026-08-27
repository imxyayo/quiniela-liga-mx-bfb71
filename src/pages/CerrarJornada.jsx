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
    return (
      <p className="text-sm text-[var(--dash-muted)]">Buscando jornada en curso…</p>
    );
  }

  if (!jornada) {
    return (
      <p className="text-sm text-[var(--dash-muted)]">
        No hay jornada en curso para cerrar.
      </p>
    );
  }

  if (resultado) {
    return (
      <div className="w-full max-w-lg rounded-xl border border-[var(--dash-gold)]/30 bg-[var(--dash-surface)]/60 p-5 backdrop-blur-md">
        <h3 className="text-lg font-bold">Jornada {jornada.numero} cerrada</h3>
        <p className="mb-1 mt-1 font-mono text-[11px] uppercase tracking-wider text-[var(--dash-gold)]">
          {resultado.ganadores.length > 1 ? "Ganadores" : "Ganador"}
        </p>
        <p className="mb-4 text-xs text-[var(--dash-muted)]">
          {resultado.numParticipantes} participantes · $
          {resultado.premioTotal.toLocaleString("es-MX")} repartidos
        </p>

        <ul className="flex flex-col gap-2">
          {resultado.ganadores.map((g) => (
            <li
              key={g.uid}
              className="flex items-center justify-between gap-3 rounded-lg bg-[var(--dash-gold-soft)] px-4 py-3"
            >
              <span className="min-w-0 truncate text-sm font-semibold">{g.nombre}</span>
              <span className="flex-shrink-0 text-xs text-[var(--dash-muted)]">
                {g.aciertos} aciertos
              </span>
              <span className="flex-shrink-0 font-mono text-sm font-bold text-[var(--dash-gold)]">
                ${resultado.premioIndividual.toLocaleString("es-MX")}
              </span>
            </li>
          ))}
        </ul>

        {resultado.siguienteInfo && (
          <p
            className={`mt-4 rounded border-l-4 px-3 py-2 text-xs ${
              resultado.siguienteInfo.ok
                ? "border-[var(--dash-acierto)] bg-[var(--dash-acierto-soft)] text-[var(--dash-acierto)]"
                : "border-[var(--dash-fallo)] bg-[var(--dash-fallo-soft)] text-[var(--dash-fallo)]"
            }`}
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
    <div className="w-full max-w-lg rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)]/60 p-5 backdrop-blur-md">
      <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-[var(--dash-muted)]">
        Jornada {jornada.numero}
      </span>
      <p className="mb-4 text-sm text-[var(--dash-white)]">
        {partidosFinalizados} de {totalPartidos} partidos finalizados
      </p>

      {!todosFinalizados && (
        <div className="mb-4 rounded-lg border border-[var(--dash-fallo)]/30 bg-[var(--dash-fallo-soft)] p-4">
          <p className="mb-3 text-xs leading-relaxed text-[var(--dash-fallo)]">
            Todavía hay partidos sin resultado. Cerrar ahora puede dejar
            aciertos incompletos para todos.
          </p>
          <label className="flex cursor-pointer items-center gap-2 rounded border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2">
            <input
              type="checkbox"
              checked={forzar}
              onChange={(e) => setForzar(e.target.checked)}
              className="h-4 w-4 accent-[var(--dash-fallo)]"
            />
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dash-fallo)]">
              Entiendo, cerrar de todas formas
            </span>
          </label>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded border-l-4 border-[var(--dash-fallo)] bg-[var(--dash-fallo-soft)] px-3 py-2 text-sm text-[var(--dash-fallo)]">
          {error}
        </div>
      )}

      <button
        onClick={handleCerrar}
        disabled={procesando || (!todosFinalizados && !forzar)}
        className="w-full rounded border border-[var(--dash-gold)] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[var(--dash-gold)] transition hover:bg-[var(--dash-gold-soft)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {procesando ? "Cerrando…" : "Cerrar jornada y calcular ganador"}
      </button>
    </div>
  );
}