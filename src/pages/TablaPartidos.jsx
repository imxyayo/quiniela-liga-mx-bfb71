import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../hooks/useAuth";
import "./TablaPartidos.css";

export default function TablaPartidos() {
  const { usuario } = useAuth();
  const [jornada, setJornada] = useState(null);
  const [partidos, setPartidos] = useState([]);
  const [predicciones, setPredicciones] = useState({}); // { id_partido: "local"|"empate"|"visitante" }
  const [enviadas, setEnviadas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // 1. Cargar la jornada "en_curso" y sus partidos
  useEffect(() => {
    const cargarJornada = async () => {
      try {
        const q = query(
          collection(db, "jornadas"),
          where("estado", "==", "en_curso")
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setError("No hay jornada en curso. Espera a que el admin abra una.");
          setCargando(false);
          return;
        }

        const jornadaDoc = querySnapshot.docs[0];
        const datosJornada = jornadaDoc.data();
        setJornada(datosJornada);
        setPartidos(datosJornada.partidos || []);

        // 2. Verificar si ya envio predicciones
        const docId = `jornada_${datosJornada.numero}_${usuario.uid}`;
        const docRef = doc(db, "predicciones", docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setEnviadas(true);
          const prediccionesGuardadas = {};
          docSnap.data().predicciones.forEach((p) => {
            prediccionesGuardadas[p.id_partido] = p.prediccion;
          });
          setPredicciones(prediccionesGuardadas);
        } else {
          const prediccionesIniciales = {};
          datosJornada.partidos.forEach((p) => {
            prediccionesIniciales[p.id] = null;
          });
          setPredicciones(prediccionesIniciales);
        }

        setCargando(false);
      } catch (err) {
        console.error("Error cargando jornada:", err);
        setError("Error al cargar la jornada");
        setCargando(false);
      }
    };

    cargarJornada();
  }, [usuario.uid]);

  const handleSeleccionar = (idPartido, prediccion) => {
    if (enviadas) return;
    setPredicciones((prev) => ({
      ...prev,
      [idPartido]: prediccion,
    }));
  };

  const handleEnviarPredicciones = async () => {
    if (!jornada) return;

    const todosSeleccionados = partidos.every((p) => predicciones[p.id] !== null);
    if (!todosSeleccionados) {
      setError("Debes hacer una predicción en cada partido antes de enviar.");
      return;
    }

    try {
      const prediccionesArray = partidos.map((p) => ({
        id_partido: p.id,
        prediccion: predicciones[p.id],
      }));

      const docId = `jornada_${jornada.numero}_${usuario.uid}`;
      const docRef = doc(db, "predicciones", docId);

      await setDoc(docRef, {
        uid: usuario.uid,
        numero_jornada: jornada.numero,
        predicciones: prediccionesArray,
        guardadoEn: new Date().toISOString(),
        resultado: null,
      });

      setEnviadas(true);
      setError("");
    } catch (err) {
      console.error("Error guardando predicciones:", err);
      setError("Ocurrió un error al guardar tus predicciones. Intenta de nuevo.");
    }
  };

  if (cargando) {
    return (
      <div className="tp-page">
        <div className="tp-estado">Cargando jornada…</div>
      </div>
    );
  }

  if (error && !jornada) {
    return (
      <div className="tp-page">
        <div className="tp-estado tp-estado--error">{error}</div>
      </div>
    );
  }

  if (!jornada || partidos.length === 0) {
    return (
      <div className="tp-page">
        <div className="tp-estado">No hay partidos disponibles.</div>
      </div>
    );
  }

  return (
    <div className="tp-page">
      <div className="tp-container">
        <header className="tp-header">
          <div>
            <span className="tp-eyebrow">Predicciones</span>
            <h2>Jornada {jornada.numero}</h2>
          </div>
          {enviadas && (
            <span className="tp-badge tp-badge--enviado">Predicciones enviadas</span>
          )}
        </header>

        {error && <div className="tp-error">{error}</div>}

        <div className="tp-lista">
          {partidos.map((partido) => (
            <div key={partido.id} className="tp-card">
              <div className="tp-card-top">
                <div className="tp-equipos">
                  <span className="tp-equipo">{partido.equipo_local}</span>
                  <span className="tp-vs">vs</span>
                  <span className="tp-equipo tp-equipo--visitante">
                    {partido.equipo_visitante}
                  </span>
                </div>
                <span className="tp-fecha">
                  {partido.fecha} · {partido.hora}
                </span>
              </div>

              <div className="tp-opciones">
                <button
                  type="button"
                  className={`tp-opcion ${predicciones[partido.id] === "local" ? "tp-opcion--activa" : ""}`}
                  onClick={() => handleSeleccionar(partido.id, "local")}
                  disabled={enviadas}
                >
                  {partido.equipo_local}
                </button>
                <button
                  type="button"
                  className={`tp-opcion tp-opcion--empate ${predicciones[partido.id] === "empate" ? "tp-opcion--activa" : ""}`}
                  onClick={() => handleSeleccionar(partido.id, "empate")}
                  disabled={enviadas}
                >
                  Empate
                </button>
                <button
                  type="button"
                  className={`tp-opcion ${predicciones[partido.id] === "visitante" ? "tp-opcion--activa" : ""}`}
                  onClick={() => handleSeleccionar(partido.id, "visitante")}
                  disabled={enviadas}
                >
                  {partido.equipo_visitante}
                </button>
              </div>
            </div>
          ))}
        </div>

        {!enviadas && (
          <div className="tp-enviar-container">
            <button className="tp-btn-enviar" onClick={handleEnviarPredicciones}>
              Enviar predicciones
            </button>
          </div>
        )}

        {enviadas && (
          <div className="tp-confirmacion">
            Tus predicciones ya quedaron guardadas y no se pueden cambiar.
          </div>
        )}
      </div>
    </div>
  );
}