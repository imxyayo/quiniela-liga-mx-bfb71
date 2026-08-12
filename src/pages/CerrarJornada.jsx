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

const PREMIO_TOTAL = 2700;

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

    // --- DIAGNÓSTICO: confirmar quién está realmente logueado en este momento ---
    console.log("[cerrar] auth.currentUser completo:", auth.currentUser);
    console.log("[cerrar] uid actual:", auth.currentUser?.uid);
    console.log(
      "[cerrar] ¿coincide con el admin esperado?",
      auth.currentUser?.uid === "CNTWR8yNC0SIaRtELk8aW9eldvC2"
    );
    try {
      const token = await auth.currentUser?.getIdTokenResult(true); // true = forzar refresh
      console.log("[cerrar] token claims:", token?.claims);
      console.log("[cerrar] token expira:", token?.expirationTime);
    } catch (tokenErr) {
      console.error("[cerrar] No se pudo obtener el token:", tokenErr);
    }
    // --- FIN DIAGNÓSTICO ---

    try {
      let snap;
      try {
        const q = query(
          collection(db, "predicciones"),
          where("numero_jornada", "==", jornada.numero)
        );
        snap = await getDocs(q);
      } catch (err) {
        console.error("[cerrar] Falló leyendo predicciones. code:", err.code, "err:", err);
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

      const ganadores = filas.filter((f) => f.aciertos === mejorAciertos);
      const premioIndividual =
        Math.round((PREMIO_TOTAL / ganadores.length) * 100) / 100;

      let nombresPorUid = {};
      try {
        // --- DIAGNÓSTICO extra justo antes de la lectura que falla ---
        console.log(
          "[cerrar] justo antes de leer usuarios, uid:",
          auth.currentUser?.uid
        );
        const usuariosSnap = await getDocs(collection(db, "usuarios"));
        console.log("[cerrar] lectura de usuarios OK, docs:", usuariosSnap.size);
        usuariosSnap.docs.forEach((u) => {
          nombresPorUid[u.id] = u.data().nombre || "Jugador";
        });
      } catch (err) {
        console.error("[cerrar] Falló leyendo usuarios. code:", err.code, "err:", err);
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
      });

      try {
        await batch.commit();
      } catch (err) {
        console.error("[cerrar] Falló el batch.commit. code:", err.code, "err:", err);
        throw new Error("El batch de escritura falló (revisa reglas de 'predicciones' o 'jornadas').");
      }

      setResultado({ ganadores: ganadoresConNombre, premioIndividual });
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