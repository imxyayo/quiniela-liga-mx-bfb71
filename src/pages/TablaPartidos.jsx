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

// Codigo corto para el escudo circular (solo visual, no toca datos guardados)
function codigoEquipo(nombre) {
  return (nombre || "").trim().slice(0, 3).toUpperCase();
}

export default function TablaPartidos() {
  const { usuario } = useAuth();
  const [jornada, setJornada] = useState(null);
  const [partidos, setPartidos] = useState([]);
  const [predicciones, setPredicciones] = useState({}); // { id_partido: "local"|"empate"|"visitante" }
  const [enviadas, setEnviadas] = useState(false);
  const [pagoConfirmado, setPagoConfirmado] = useState(false);
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

        // 1.5 Verificar si el admin ya confirmó el pago de este usuario
        // para esta jornada. Si no, no se muestran los partidos.
        const yaPago = !!(datosJornada.pagos && datosJornada.pagos[usuario.uid]);
        setPagoConfirmado(yaPago);

        if (!yaPago) {
          setCargando(false);
          return;
        }

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

  // ===== Estados simples (cargando / error / sin jornada) =====
  if (cargando) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[var(--dash-bg)] font-['Inter',sans-serif] text-[var(--dash-muted)]">
        Cargando jornada…
      </div>
    );
  }

  if (error && !jornada) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[var(--dash-bg)] px-6 text-center font-['Inter',sans-serif] text-[var(--dash-fallo)]">
        {error}
      </div>
    );
  }

  if (!jornada || partidos.length === 0) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[var(--dash-bg)] font-['Inter',sans-serif] text-[var(--dash-muted)]">
        No hay partidos disponibles.
      </div>
    );
  }

  // Si el admin todavía no marca el pago de este usuario para esta
  // jornada, no se muestra ningún partido ni formulario de predicción.
  if (!pagoConfirmado) {
    const clabe = "012180015792710307";
    const whatsappUrl = `https://wa.me/527207999106?text=${encodeURIComponent(
      `Hola! Aquí está mi comprobante de pago para la Jornada ${jornada.numero}`
    )}`;

    const copiarClabe = () => {
      navigator.clipboard?.writeText(clabe);
    };

    return (
      <div className="min-h-screen w-full bg-[var(--dash-bg)]">
        <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 font-['Inter',sans-serif] text-[var(--dash-white)]">
          <div className="mb-3 inline-flex items-center rounded border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-1">
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--dash-gold)]">
              Predicciones
            </span>
          </div>
          <h2 className="mb-6 text-2xl font-bold">Jornada {jornada.numero}</h2>

          <div className="rounded-xl border border-[var(--dash-gold)] bg-[var(--dash-gold-soft)] p-5">
            <p className="mb-4 text-sm text-[var(--dash-gold)]">
              Aún no se ha confirmado tu pago de esta jornada. Transfiere tu
              cuota y mándame el comprobante por WhatsApp para darte acceso.
            </p>

            <div className="mb-4 space-y-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)]/70 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dash-muted)]">
                  Banco
                </span>
                <span className="text-sm font-semibold">BBVA Bancomer</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dash-muted)]">
                  CLABE
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold tracking-wide">
                    {clabe}
                  </span>
                  <button
                    type="button"
                    onClick={copiarClabe}
                    className="rounded border border-[var(--dash-border)] px-2 py-0.5 font-mono text-[10px] uppercase text-[var(--dash-muted)] transition hover:border-[var(--dash-gold)] hover:text-[var(--dash-gold)]"
                  >
                    Copiar
                  </button>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dash-muted)]">
                  Titular
                </span>
                <span className="text-sm font-semibold">Jair Prieto Dorantes</span>
              </div>
            </div>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded bg-[var(--dash-gold)] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[#14120c] transition hover:brightness-110"
            >
              Enviar comprobante por WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

  const seleccionados = Object.values(predicciones).filter(Boolean).length;

  return (
    <div className="min-h-screen w-full bg-[var(--dash-bg)]">
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 font-['Inter',sans-serif] text-[var(--dash-white)]">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 border-b border-[var(--dash-border)] pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center rounded border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-1">
              <span className="font-mono text-xs uppercase tracking-wider text-[var(--dash-gold)]">
                Jornada {jornada.numero}
              </span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight">Mis Pronósticos</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--dash-muted)]">
                Progreso
              </p>
              <p className="text-lg font-semibold text-[var(--dash-gold)]">
                {seleccionados} / {partidos.length} partidos
              </p>
            </div>
            {!enviadas && (
              <button
                onClick={handleEnviarPredicciones}
                className="rounded bg-[var(--dash-gold)] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[#14120c] transition hover:brightness-110 active:translate-y-px"
              >
                Enviar
              </button>
            )}
            {enviadas && (
              <span className="rounded-full bg-[var(--dash-acierto-soft)] px-4 py-2 font-mono text-xs font-semibold text-[var(--dash-acierto)]">
                Enviadas
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded border-l-4 border-[var(--dash-fallo)] bg-[var(--dash-fallo-soft)] px-4 py-3 text-sm text-[var(--dash-fallo)]">
            {error}
          </div>
        )}

        {/* Grid de partidos */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {partidos.map((partido) => {
            const activa = predicciones[partido.id];
            return (
              <div
                key={partido.id}
                className="relative overflow-hidden rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)]/70 p-5 backdrop-blur-md transition-colors hover:border-[var(--dash-gold)]/50"
              >
                {activa && (
                  <div className="absolute right-0 top-0 h-full w-1 bg-[var(--dash-gold)]" />
                )}

                <div className="mb-5 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-[var(--dash-muted)]">
                    {partido.fecha} · {partido.hora}
                  </span>
                  <span className="rounded border border-[var(--dash-gold)]/30 bg-[var(--dash-gold-soft)] px-2 py-1 font-mono text-[10px] text-[var(--dash-gold)]">
                    Liga MX
                  </span>
                </div>

                <div className="mb-6 flex items-center justify-between">
                  <div className="flex flex-1 flex-col items-center text-center">
                    <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface-alt)] font-mono text-xs font-bold text-[var(--dash-gold)]">
                      {codigoEquipo(partido.equipo_local)}
                    </div>
                    <span className="text-sm font-semibold">{partido.equipo_local}</span>
                  </div>
                  <span className="px-3 text-lg font-extrabold text-[var(--dash-muted)]/50">
                    VS
                  </span>
                  <div className="flex flex-1 flex-col items-center text-center">
                    <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface-alt)] font-mono text-xs font-bold text-[var(--dash-gold)]">
                      {codigoEquipo(partido.equipo_visitante)}
                    </div>
                    <span className="text-sm font-semibold">{partido.equipo_visitante}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={enviadas}
                    onClick={() => handleSeleccionar(partido.id, "local")}
                    className={`rounded-lg py-3 text-xs font-semibold transition-all disabled:cursor-not-allowed ${
                      activa === "local"
                        ? "bg-gradient-to-b from-[#f0ce91] to-[var(--dash-gold)] font-bold text-[#412d00]"
                        : "border border-[var(--dash-border)] bg-[var(--dash-surface-alt)] text-[var(--dash-muted)] hover:border-[var(--dash-gold)] hover:text-[var(--dash-gold)] disabled:opacity-50"
                    }`}
                  >
                    {partido.equipo_local}
                  </button>
                  <button
                    type="button"
                    disabled={enviadas}
                    onClick={() => handleSeleccionar(partido.id, "empate")}
                    className={`rounded-lg py-3 text-xs font-semibold transition-all disabled:cursor-not-allowed ${
                      activa === "empate"
                        ? "bg-gradient-to-b from-[#f0ce91] to-[var(--dash-gold)] font-bold text-[#412d00]"
                        : "border border-[var(--dash-border)] bg-[var(--dash-surface-alt)] text-[var(--dash-muted)] hover:border-[var(--dash-gold)] hover:text-[var(--dash-gold)] disabled:opacity-50"
                    }`}
                  >
                    Empate
                  </button>
                  <button
                    type="button"
                    disabled={enviadas}
                    onClick={() => handleSeleccionar(partido.id, "visitante")}
                    className={`rounded-lg py-3 text-xs font-semibold transition-all disabled:cursor-not-allowed ${
                      activa === "visitante"
                        ? "bg-gradient-to-b from-[#f0ce91] to-[var(--dash-gold)] font-bold text-[#412d00]"
                        : "border border-[var(--dash-border)] bg-[var(--dash-surface-alt)] text-[var(--dash-muted)] hover:border-[var(--dash-gold)] hover:text-[var(--dash-gold)] disabled:opacity-50"
                    }`}
                  >
                    {partido.equipo_visitante}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {enviadas && (
          <div className="mt-6 rounded-lg border-l-4 border-[var(--dash-acierto)] bg-[var(--dash-acierto-soft)] px-4 py-3 text-center text-sm text-[var(--dash-acierto)]">
            Tus predicciones ya quedaron guardadas y no se pueden cambiar.
          </div>
        )}
      </div>
    </div>
  );
}