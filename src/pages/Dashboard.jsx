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

// Deben coincidir con los mismos valores en GestionPagos.jsx y CerrarJornada.jsx.
const CUOTA_POR_PERSONA = 100;
const COMISION_ADMIN = 10;
const APORTE_AL_BOTE = CUOTA_POR_PERSONA - COMISION_ADMIN;

const RESULTADO_LABEL = {
  local: "Local",
  empate: "Empate",
  visitante: "Visitante",
};

function iniciales(nombre) {
  return (nombre || "?")
    .trim()
    .split(/\s+/)
    .map((palabra) => palabra[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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
      <div className="flex min-h-screen w-full items-center justify-center bg-[var(--dash-bg)] font-['Inter',sans-serif] text-[var(--dash-muted)]">
        Cargando tu jornada…
      </div>
    );
  }

  if (!jornada) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[var(--dash-bg)] font-['Inter',sans-serif] text-[var(--dash-muted)]">
        No hay una jornada activa por ahora.
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

  // Bote en vivo: cuántos ya confirmó el admin como pagados, y cuánto
  // suma eso ya descontada la comisión. No se muestra la comisión en sí,
  // solo lo que efectivamente va al premio.
  const pagos = jornada.pagos || {};
  const numPagados = Object.values(pagos).filter(Boolean).length;
  const premioActual = numPagados * APORTE_AL_BOTE;

  return (
    <div className="min-h-screen w-full bg-[var(--dash-bg)]">
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 font-['Inter',sans-serif] text-[var(--dash-white)]">
        {/* Header */}
        <header className="mb-6 flex items-center gap-4">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-[var(--dash-gold)] bg-[var(--dash-gold-soft)] font-mono text-base font-bold text-[var(--dash-gold)]">
            {iniciales(perfil?.nombre)}
          </span>
          <div>
            <span className="mb-1 block font-mono text-xs uppercase tracking-widest text-[var(--dash-gold)]">
              Jornada {jornada.numero}
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Hola, {perfil?.nombre || "amigo"}
            </h1>
          </div>
        </header>

        {/* Premio / bote en vivo */}
        <section className="mb-8 overflow-hidden rounded-xl border border-[var(--dash-gold)]/40 bg-gradient-to-br from-[var(--dash-gold-soft)] via-[var(--dash-surface)]/60 to-[var(--dash-surface)]/60 p-6 backdrop-blur-md">
          <span className="block font-mono text-[11px] uppercase tracking-widest text-[var(--dash-muted)]">
            Premio de esta jornada
          </span>
          <span className="mt-1 block text-4xl font-extrabold tracking-tight text-[var(--dash-gold)]">
            ${premioActual.toLocaleString("es-MX")}
          </span>
          <span className="mt-1 block text-xs text-[var(--dash-muted)]">
            {numPagados}{" "}
            {numPagados === 1 ? "participante confirmado" : "participantes confirmados"}
          </span>
        </section>

        {/* Stats */}
        <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)]/60 p-4 text-center backdrop-blur-md">
            <span className="block text-3xl font-extrabold text-[var(--dash-acierto)]">
              {aciertos}
            </span>
            <span className="mt-1 block font-mono text-[11px] uppercase tracking-wider text-[var(--dash-muted)]">
              Aciertos
            </span>
          </div>
          <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)]/60 p-4 text-center backdrop-blur-md">
            <span className="block text-3xl font-extrabold text-[var(--dash-fallo)]">
              {fallos}
            </span>
            <span className="mt-1 block font-mono text-[11px] uppercase tracking-wider text-[var(--dash-muted)]">
              Fallos
            </span>
          </div>
          <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)]/60 p-4 text-center backdrop-blur-md">
            <span className="block text-3xl font-extrabold text-[var(--dash-muted)]">
              {pendientes}
            </span>
            <span className="mt-1 block font-mono text-[11px] uppercase tracking-wider text-[var(--dash-muted)]">
              Por jugar
            </span>
          </div>
          <div className="rounded-xl border border-[var(--dash-gold)]/40 bg-[var(--dash-surface)]/60 p-4 text-center backdrop-blur-md">
            <div className="mx-auto mb-1 flex h-11 w-11 flex-col items-center justify-center rounded-full border border-[var(--dash-gold)]">
              <span className="text-base font-bold leading-none text-[var(--dash-gold)]">
                {posicion ?? "—"}
              </span>
              <span className="text-[8px] leading-none text-[var(--dash-muted)]">
                de {total}
              </span>
            </div>
            <span className="mt-1 block font-mono text-[11px] uppercase tracking-wider text-[var(--dash-muted)]">
              Tu posición
            </span>
          </div>
        </div>

        {/* Fixture */}
        <section>
          <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-[var(--dash-muted)]">
            Tus predicciones
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

              const chip = {
                acierto: {
                  wrap: "border-[var(--dash-acierto)]/40 bg-[var(--dash-acierto-soft)] text-[var(--dash-acierto)]",
                  icon: <IconCheck />,
                  texto: "Acierto",
                },
                fallo: {
                  wrap: "border-[var(--dash-fallo)]/40 bg-[var(--dash-fallo-soft)] text-[var(--dash-fallo)]",
                  icon: <IconCross />,
                  texto: "Fallo",
                },
                pendiente: {
                  wrap: "border-[var(--dash-border)] bg-[var(--dash-surface-alt)] text-[var(--dash-muted)]",
                  icon: <IconDot />,
                  texto: "Por jugar",
                },
              }[estado];

              return (
                <article
                  key={partido.id}
                  className="relative flex flex-col overflow-hidden rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)]/50 p-5 backdrop-blur-md transition-colors hover:border-[var(--dash-gold)]/30"
                >
                  <header className="mb-5 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-[var(--dash-muted)]">
                      {partido.fecha} · {partido.hora}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider ${chip.wrap}`}
                    >
                      {chip.icon}
                      {chip.texto}
                    </span>
                  </header>

                  <div className="mb-5 flex items-center justify-between">
                    <span className="flex-1 text-center text-sm font-semibold">
                      {partido.equipo_local}
                    </span>
                    <span className="px-3 font-mono text-xs font-bold uppercase tracking-widest text-[var(--dash-muted)]">
                      {finalizado ? RESULTADO_LABEL[partido.resultado] : "vs"}
                    </span>
                    <span className="flex-1 text-center text-sm font-semibold">
                      {partido.equipo_visitante}
                    </span>
                  </div>

                  <div className="-mx-5 -mb-5 mt-auto flex items-center justify-between rounded-b-xl border-t border-[var(--dash-border)]/60 bg-[var(--dash-surface-alt)]/60 px-5 py-3">
                    <span className="text-xs text-[var(--dash-muted)]">Tu predicción</span>
                    <span className="rounded border border-[var(--dash-border)] bg-[var(--dash-surface)] px-2 py-0.5 font-mono text-xs font-semibold text-[var(--dash-white)]">
                      {prediccion ? RESULTADO_LABEL[prediccion.prediccion] : "sin enviar"}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}