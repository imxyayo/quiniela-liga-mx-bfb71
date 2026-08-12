import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../hooks/useAuth";
import "./Leaderboard.css";

function calcularAciertos(partidos, predicciones) {
  let aciertos = 0;
  partidos.forEach((partido) => {
    const finalizado = partido.estado === "finalizado" && partido.resultado;
    if (!finalizado) return;
    const prediccion = predicciones.find((p) => p.id_partido === partido.id);
    if (prediccion && prediccion.prediccion === partido.resultado) {
      aciertos += 1;
    }
  });
  return aciertos;
}

export default function Leaderboard() {
  const { usuario } = useAuth();
  const [jornada, setJornada] = useState(null);
  const [usuarios, setUsuarios] = useState({}); // { uid: nombre }
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);

  // 1. Jornada activa
  useEffect(() => {
    const q = query(collection(db, "jornadas"), where("estado", "==", "en_curso"));
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

  // 2. Todos los usuarios, para mostrar nombre en vez de uid
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "usuarios"), (snap) => {
      const mapa = {};
      snap.docs.forEach((d) => {
        mapa[d.id] = d.data().nombre || "Sin nombre";
      });
      setUsuarios(mapa);
    });
    return unsub;
  }, []);

  // 3. Todas las predicciones de la jornada -> calcular ranking
  useEffect(() => {
    if (!jornada) return;
    const q = query(
      collection(db, "predicciones"),
      where("numero_jornada", "==", jornada.numero)
    );
    const unsub = onSnapshot(q, (snap) => {
      const datos = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: data.uid,
          aciertos: calcularAciertos(jornada.partidos, data.predicciones || []),
        };
      });
      datos.sort((a, b) => b.aciertos - a.aciertos);
      setFilas(datos);
      setCargando(false);
    });
    return unsub;
  }, [jornada]);

  if (cargando) {
    return (
      <div className="lb-page">
        <div className="lb-estado">Cargando ranking…</div>
      </div>
    );
  }

  if (!jornada) {
    return (
      <div className="lb-page">
        <div className="lb-estado">No hay una jornada activa por ahora.</div>
      </div>
    );
  }

  const lider = filas[0]?.aciertos ?? 0;

  return (
    <div className="lb-page">
      <div className="lb-container">
        <header className="lb-header">
          <span className="lb-eyebrow">Jornada {jornada.numero}</span>
          <h2>Leaderboard</h2>
        </header>

        {filas.length === 0 ? (
          <p className="lb-vacio">Nadie ha enviado predicciones todavía.</p>
        ) : (
          <div className="lb-lista">
            {filas.map((fila, i) => {
              const posicion = i + 1;
              const esLider = posicion === 1;
              const esYo = fila.uid === usuario?.uid;
              const diferencia = lider - fila.aciertos;

              return (
                <div
                  key={fila.uid}
                  className={`lb-fila ${esYo ? "lb-fila--yo" : ""} ${esLider ? "lb-fila--lider" : ""}`}
                >
                  <span className="lb-posicion">{posicion}</span>
                  <span className="lb-nombre">
                    {usuarios[fila.uid] || "Jugador"}
                    {esYo && <span className="lb-tag-tu">Tú</span>}
                  </span>
                  <span className="lb-aciertos">
                    {fila.aciertos} <small>aciertos</small>
                  </span>
                  <span className="lb-diferencia">
                    {esLider ? "Líder" : `-${diferencia}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}