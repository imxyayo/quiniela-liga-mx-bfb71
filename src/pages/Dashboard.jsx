import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../hooks/useAuth";
import "./Dashboard.css";

const RESULTADO_LABEL = {
  local: "Local",
  empate: "Empate",
  visitante: "Visitante",
};

// Iconos SVG minimos, sin librerias externas
function IconCheck() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M3 8.5L6.2 11.5L13 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCross() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconDot() {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
      <circle cx="8" cy="8" r="4" fill="currentColor" />
    </svg>
  );
}

// Compara predicciones contra resultados y devuelve el conteo
function calcularAciertos(partidos, predicciones) {
  let aciertos = 0;
  let fallos = 0;
  let pendientes = 0;

  partidos.forEach((partido) => {
    const prediccion = predicciones.find((p) => p.id_partido === partido.id);
    const finalizado = partido.estado === "finalizado" && partido.resultado;

    if (!finalizado) {
      pendientes += 1;
      return;
    }
    if (!prediccion) {
      fallos += 1; // no predijo y el partido ya se jugo
      return;
    }
    if (prediccion.prediccion === partido.resultado) {
      aciertos += 1;
    } else {
      fallos += 1;
    }
  });

  return { aciertos, fallos, pendientes };
}

export default function Dashboard() {
  const { usuario, perfil } = useAuth();
  const [jornada, setJornada] = useState(null);
  const [prediccionDoc, setPrediccionDoc] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [cargando, setCargando] = useState(true);

  // 1. Jornada activa
  useEffect(() => {
    const q = query(
      collection(db, "jornadas"),
      where("estado", "==", "en_curso")
    );
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setJornada(null);
        setCargando(false);
        return;
      }
      const primera = snap.docs[0];
      setJornada({ id: primera.id, ...primera.data() });
    });
    return unsub;
  }, []);

  // 2. Mi prediccion para esa jornada
  useEffect(() => {
    if (!jornada || !usuario) return;
    const ref = doc(db, "predicciones", `${jornada.id}_${usuario.uid}`);
    const unsub = onSnapshot(ref, (snap) => {
      setPrediccionDoc(snap.exists() ? snap.data() : null);
    });
    return unsub;
  }, [jornada, usuario]);

  // 3. Todas las predicciones de la jornada, para el ranking
  useEffect(() => {
    if (!jornada) return;
    const q = query(
      collection(db, "predicciones"),
      where("numero_jornada", "==", jornada.numero)
    );
    const unsub = onSnapshot(q, (snap) => {
      const filas = snap.docs.map((d) => {
        const data = d.data();
        const { aciertos } = calcularAciertos(
          jornada.partidos,
          data.predicciones || []
        );
        return { uid: data.uid, aciertos };
      });
      filas.sort((a, b) => b.aciertos - a.aciertos);
      setRanking(filas);
      setCargando(false);
    });
    return unsub;
  }, [jornada]);

  if (cargando) {
    return (
      <div className="dashboard-page">
        <div className="dash-estado">Cargando tu jornada…</div>
      </div>
    );
  }

  if (!jornada) {
    return (
      <div className="dashboard-page">
        <div className="dash-estado">No hay una jornada activa por ahora.</div>
      </div>
    );
  }

  const predicciones = prediccionDoc?.predicciones || [];
  const { aciertos, fallos, pendientes } = calcularAciertos(
    jornada.partidos,
    predicciones
  );
  const posicionIndex = ranking.findIndex((f) => f.uid === usuario?.uid);
  const posicion = posicionIndex >= 0 ? posicionIndex + 1 : null;
  const total = ranking.length;

  return (
    <div className="dashboard-page">
    <div className="dashboard">
      <header className="dash-header">
        <span className="dash-eyebrow">Jornada {jornada.numero}</span>
        <h1>Hola, {perfil?.nombre || "amigo"}</h1>
      </header>

      <div className="dash-stats">
        <div className="stat stat--acierto">
          <span className="stat-valor">{aciertos}</span>
          <span className="stat-label">Aciertos</span>
        </div>
        <div className="stat stat--fallo">
          <span className="stat-valor">{fallos}</span>
          <span className="stat-label">Fallos</span>
        </div>
        <div className="stat stat--pendiente">
          <span className="stat-valor">{pendientes}</span>
          <span className="stat-label">Por jugar</span>
        </div>
        <div className="stat stat--posicion">
          <div className="posicion-badge">
            <span className="posicion-numero">{posicion ?? "—"}</span>
            <span className="posicion-total">de {total}</span>
          </div>
          <span className="stat-label">Tu posición</span>
        </div>
      </div>

      <section className="fixture">
        <h2 className="fixture-titulo">Tus predicciones</h2>
        <div className="fixture-lista">
          {jornada.partidos.map((partido) => {
            const prediccion = predicciones.find(
              (p) => p.id_partido === partido.id
            );
            const finalizado =
              partido.estado === "finalizado" && partido.resultado;
            const acerto =
              finalizado && prediccion?.prediccion === partido.resultado;
            const fallo =
              finalizado &&
              (!prediccion || prediccion.prediccion !== partido.resultado);

            let estado = "pendiente";
            if (acerto) estado = "acierto";
            else if (fallo) estado = "fallo";

            return (
              <div
                key={partido.id}
                className={`fixture-fila fixture-fila--${estado}`}
              >
                <div className="fixture-equipos">
                  <span className="equipo">{partido.equipo_local}</span>
                  <span className="fixture-centro">
                    {finalizado ? RESULTADO_LABEL[partido.resultado] : "VS"}
                  </span>
                  <span className="equipo equipo--visitante">
                    {partido.equipo_visitante}
                  </span>
                </div>

                <div className="fixture-detalle">
                  <span className="fixture-pick">
                    Tu pick:{" "}
                    <strong>
                      {prediccion
                        ? RESULTADO_LABEL[prediccion.prediccion]
                        : "sin enviar"}
                    </strong>
                  </span>
                  <span className={`fixture-indicador fixture-indicador--${estado}`}>
                    {estado === "acierto" && (
                      <>
                        <IconCheck /> Acierto
                      </>
                    )}
                    {estado === "fallo" && (
                      <>
                        <IconCross /> Fallo
                      </>
                    )}
                    {estado === "pendiente" && (
                      <>
                        <IconDot /> Por jugar
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
    </div>
  );
}