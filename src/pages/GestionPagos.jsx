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

// Debe coincidir con CUOTA_POR_PERSONA en CerrarJornada.jsx.
const CUOTA_POR_PERSONA = 100;

function iniciales(nombre) {
  return (nombre || "?")
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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

      setJornada((prev) => ({
        ...prev,
        pagos: {
          ...(prev.pagos || {}),
          [uid]: nuevoValor,
        },
      }));
    } catch (err) {
      console.error("[pagos] Error actualizando pago:", err);
      setError("No se pudo actualizar el pago de ese usuario. Intenta de nuevo.");
    } finally {
      setGuardandoUid(null);
    }
  };

  if (cargando) {
    return (
      <p className="text-sm text-[var(--dash-muted)]">
        Cargando usuarios y jornada activa…
      </p>
    );
  }

  if (!jornada) {
    return (
      <p className="text-sm text-[var(--dash-muted)]">
        No hay jornada en curso para gestionar pagos.
      </p>
    );
  }

  const pagos = jornada.pagos || {};
  const totalPagados = usuarios.filter((u) => pagos[u.uid]).length;
  const totalRecaudado = totalPagados * CUOTA_POR_PERSONA;
  const porcentaje = usuarios.length
    ? Math.round((totalPagados / usuarios.length) * 100)
    : 0;

  return (
    <div className="w-full max-w-lg rounded-xl border border-[var(--dash-gold)]/30 bg-[var(--dash-surface)]/60 p-5 backdrop-blur-md">
      {/* Progreso */}
      <div className="mb-5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-alt)]/60 p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <span className="block font-mono text-[11px] uppercase tracking-wider text-[var(--dash-muted)]">
              Progreso actual
            </span>
            <span className="text-lg font-bold text-[var(--dash-gold)]">
              {totalPagados} de {usuarios.length} pagaron
            </span>
          </div>
          <span className="rounded bg-[var(--dash-surface)] px-2 py-1 font-mono text-xs text-[var(--dash-white)]">
            ${totalRecaudado.toLocaleString("es-MX")} recaudados
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--dash-surface)]">
          <div
            className="h-full rounded-full bg-[var(--dash-gold)] transition-all"
            style={{ width: `${porcentaje}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border-l-4 border-[var(--dash-fallo)] bg-[var(--dash-fallo-soft)] px-3 py-2 text-sm text-[var(--dash-fallo)]">
          {error}
        </div>
      )}

      {/* Lista de usuarios */}
      <ul className="flex flex-col gap-2">
        {usuarios.map((u) => {
          const pagado = !!pagos[u.uid];
          const guardando = guardandoUid === u.uid;

          return (
            <li
              key={u.uid}
              className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors ${
                pagado
                  ? "border-[var(--dash-gold)]/30 bg-[var(--dash-gold-soft)]"
                  : "border-[var(--dash-border)] bg-[var(--dash-surface)]"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold ${
                    pagado
                      ? "border-[var(--dash-gold)]/40 bg-[var(--dash-gold-soft)] text-[var(--dash-gold)]"
                      : "border-[var(--dash-border)] bg-[var(--dash-surface-alt)] text-[var(--dash-muted)]"
                  }`}
                >
                  {iniciales(u.nombre)}
                </span>
                <span className="min-w-0 truncate text-sm text-[var(--dash-white)]">
                  {u.nombre || "Sin nombre"}
                </span>
              </div>

              <button
                type="button"
                disabled={guardando}
                onClick={() => togglePago(u.uid, pagado)}
                className={`flex-shrink-0 rounded px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition disabled:opacity-50 ${
                  pagado
                    ? "bg-[var(--dash-gold)] text-[#14120c]"
                    : "border border-[var(--dash-border)] text-[var(--dash-muted)] hover:border-[var(--dash-gold)] hover:text-[var(--dash-gold)]"
                }`}
              >
                {guardando ? "Guardando…" : pagado ? "Pagó" : "Pendiente"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}