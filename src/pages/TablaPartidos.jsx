import React, { useState, useEffect } from "react";
import { getFirestore, collection, query, where, getDocs, setDoc, doc, getDoc } from "firebase/firestore";
import { useAuth } from "../hooks/useAuth";
import app from "../services/firebase";
import "./TablaPartidos.css";

const db = getFirestore(app);

export default function TablaPartidos() {
  const { usuario } = useAuth();
  const [jornada, setJornada] = useState(null);
  const [partidos, setPartidos] = useState([]);
  const [predicciones, setPredicciones] = useState({}); // { id_partido: "local"|"empate"|"visitante" }
  const [enviadas, setEnviadas] = useState(false); // Si ya envió predicciones
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // 1. Cargar la jornada "en_curso" y sus partidos
  useEffect(() => {
    const cargarJornada = async () => {
      try {
        const q = query(collection(db, "jornadas"), where("estado", "==", "en_curso"));
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

        // 2. Verificar si ya envió predicciones
        const docId = `jornada_${datosJornada.numero}_${usuario.uid}`;
        const docRef = doc(db, "predicciones", docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          // Ya tiene predicciones guardadas
          setEnviadas(true);
          const prediccionesGuardadas = {};
          docSnap.data().predicciones.forEach((p) => {
            prediccionesGuardadas[p.id_partido] = p.prediccion;
          });
          setPredicciones(prediccionesGuardadas);
        } else {
          // Inicializar predicciones vacías
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

  // Seleccionar predicción (solo si aún no envió)
  const handleSeleccionar = (idPartido, prediccion) => {
    if (enviadas) return; // No hacer nada si ya envió

    setPredicciones((prev) => ({
      ...prev,
      [idPartido]: prediccion,
    }));
  };

  // Enviar predicciones (una única vez)
  const handleEnviarPredicciones = async () => {
    if (!jornada) return;

    // Validar que todas las predicciones estén completas
    const todosSeleccionados = partidos.every((p) => predicciones[p.id] !== null);
    if (!todosSeleccionados) {
      setError("❌ Debes hacer una predicción en cada partido");
      return;
    }

    try {
      // Transformar predicciones al formato de Firestore
      const prediccionesArray = partidos.map((p) => ({
        id_partido: p.id,
        prediccion: predicciones[p.id],
      }));

      // Guardar en Firestore
      const docId = `jornada_${jornada.numero}_${usuario.uid}`;
      const docRef = doc(db, "predicciones", docId);

      await setDoc(docRef, {
        uid: usuario.uid,
        numero_jornada: jornada.numero,
        predicciones: prediccionesArray,
        guardadoEn: new Date().toISOString(),
        resultado: null, // Se calcula cuando la jornada cierra
      });

      setEnviadas(true);
      setError(""); // Limpiar errores
    } catch (err) {
      console.error("Error guardando predicciones:", err);
      setError("❌ Error al guardar predicciones");
    }
  };

  if (cargando) {
    return <div className="tabla-partidos-container">⏳ Cargando jornada...</div>;
  }

  if (error && !jornada) {
    return <div className="tabla-partidos-container"><p className="error-mensaje">{error}</p></div>;
  }

  if (!jornada || partidos.length === 0) {
    return <div className="tabla-partidos-container"><p>No hay partidos disponibles</p></div>;
  }

  return (
    <div className="tabla-partidos-container">
      <div className="tabla-header">
        <h2>⚽ Jornada {jornada.numero}</h2>
        {enviadas && <p className="enviadas-label">✅ Predicciones enviadas</p>}
      </div>

      {error && <div className="error-mensaje">{error}</div>}

      <div className="partidos-grid">
        {partidos.map((partido) => (
          <div key={partido.id} className="partido-card">
            <div className="partido-equipos">
              <div className="equipo-local">
                <p className="nombre-equipo">{partido.equipo_local}</p>
              </div>
              <div className="vs">vs</div>
              <div className="equipo-visitante">
                <p className="nombre-equipo">{partido.equipo_visitante}</p>
              </div>
            </div>

            <div className="partido-fecha">
              <p>{partido.fecha} {partido.hora}</p>
            </div>

            <div className="predicciones-botones">
              <button
                className={`btn-prediccion ${predicciones[partido.id] === "local" ? "selected" : ""}`}
                onClick={() => handleSeleccionar(partido.id, "local")}
                disabled={enviadas}
              >
                🏠 Local
              </button>
              <button
                className={`btn-prediccion ${predicciones[partido.id] === "empate" ? "selected" : ""}`}
                onClick={() => handleSeleccionar(partido.id, "empate")}
                disabled={enviadas}
              >
                🤝 Empate
              </button>
              <button
                className={`btn-prediccion ${predicciones[partido.id] === "visitante" ? "selected" : ""}`}
                onClick={() => handleSeleccionar(partido.id, "visitante")}
                disabled={enviadas}
              >
                ✈️ Visitante
              </button>
            </div>
          </div>
        ))}
      </div>

      {!enviadas && (
        <div className="enviar-container">
          <button className="btn-enviar" onClick={handleEnviarPredicciones}>
            📤 Enviar Predicciones
          </button>
        </div>
      )}

      {enviadas && (
        <div className="confirmacion">
          <p>✅ Tus predicciones han sido guardadas. ¡No se pueden cambiar!</p>
        </div>
      )}
    </div>
  );
}