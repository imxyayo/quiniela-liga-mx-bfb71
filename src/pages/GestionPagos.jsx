import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import "./GestionPagos.css";

// Debe coincidir con CUOTA_POR_PERSONA en CerrarJornada.jsx.
const CUOTA_POR_PERSONA = 100;

export default function GestionPagos() {
  const [jornada, setJornada] = useState(null);
  const [jornadaId, setJornadaId] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoUid, setGuardandoUid] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const cargar = async () => {
      setError("");
      try {
        // 1. Buscar la jornada en curso
        const qJornada = query(
          collection(db, "jornadas"),
          where("estado", "==", "en_curso")
        );
        const snapJornada = await getDocs(qJornada);

        if (snapJornada.empty) {
          setCargando(false);
          return;
        }

        const d = snapJornada.docs[0];
        setJornadaId(d.id);
        setJornada(d.data());

        // 2. Traer todos los usuarios registrados
        const snapUsuarios = await getDocs(collection(db, "usuarios"));
        const listaUsuarios = snapUsuarios.docs
          .map((u) => ({ uid: u.id, ...u.data() }))
          .sort((a, b) =>
            (a.nombre || "").localeCompare(b.nombre || "", "es")
          );
        setUsuarios(listaUsuarios);
      } catch (err) {
        console.error("[pagos] Error cargando datos:", err);
        setError("No se pudo cargar la lista de usuarios o la jornada activa.");
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, []);

  const togglePago = async (uid, valorActual) => {
    if (!jornadaId) return;
    setGuardandoUid(uid);
    setError("");

    const nuevoValor = !valorActual;

    try {
      await updateDoc(doc(db, "jornadas", jornadaId), {
        [`pagos.${uid}`]: nuevoValor,
      });

      // Reflejar el cambio localmente sin recargar todo
      setJornada((prev) => ({
        ...prev,
        pagos: {
          ...(prev.pagos || {}),
          [uid]: nuevoValor,
        },
      }));
    } catch (err) {
      console.error("[pagos] Error actualizando pago:", err);
      setError(`No se pudo actualizar el pago de ese usuario. Intenta de nuevo.`);
    } finally {
      setGuardandoUid(null);
    }
  };

  if (cargando) {
    return <p className="gp-cargando">Cargando usuarios y jornada activa…</p>;
  }

  if (!jornada) {
    return <p className="gp-cargando">No hay jornada en curso para gestionar pagos.</p>;
  }

  const pagos = jornada.pagos || {};
  const totalPagados = usuarios.filter((u) => pagos[u.uid]).length;
  const totalRecaudado = totalPagados * CUOTA_POR_PERSONA;

  return (
    <div className="gp-card">
      <div className="gp-info">
        <span className="gp-eyebrow">Jornada {jornada.numero}</span>
        <p className="gp-resumen">
          {totalPagados} de {usuarios.length} pagaron · $
          {totalRecaudado.toLocaleString("es-MX")} recaudados
        </p>
      </div>

      {error && <div className="gp-error">{error}</div>}

      <ul className="gp-lista">
        {usuarios.map((u) => {
          const pagado = !!pagos[u.uid];
          const guardando = guardandoUid === u.uid;

          return (
            <li key={u.uid} className="gp-item">
              <span className="gp-nombre">{u.nombre || "Sin nombre"}</span>

              <label className={`gp-toggle ${pagado ? "gp-toggle-on" : ""}`}>
                <input
                  type="checkbox"
                  checked={pagado}
                  disabled={guardando}
                  onChange={() => togglePago(u.uid, pagado)}
                />
                <span className="gp-toggle-texto">
                  {guardando ? "Guardando…" : pagado ? "Pagó" : "Pendiente"}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}