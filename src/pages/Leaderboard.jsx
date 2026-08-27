import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../hooks/useAuth";

function iniciales(nombre) {
  return (nombre || "?")
    .trim()
    .split(/\s+/)
    .map((palabra) => palabra[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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

// Estilo de cada escalon del podio (1ro, 2do, 3ro)
const PODIO_ESTILO = {
  1: {
    orden: "order-2",
    ancho: "w-28 md:w-36",
    alturaBarra: "h-40 md:h-56",
    avatar: "h-20 w-20 md:h-24 md:w-24",
    borde: "border-[var(--dash-gold)]",
    texto: "text-[var(--dash-gold)]",
    sombra: "shadow-[0_0_20px_rgba(201,169,97,0.25)]",
  },
  2: {
    orden: "order-1",
    ancho: "w-24 md:w-32",
    alturaBarra: "h-28 md:h-40",
    avatar: "h-14 w-14 md:h-16 md:w-16",
    borde: "border-[#b8bec7]",
    texto: "text-[#b8bec7]",
    sombra: "",
  },
  3: {
    orden: "order-3",
    ancho: "w-24 md:w-32",
    alturaBarra: "h-20 md:h-32",
    avatar: "h-14 w-14 md:h-16 md:w-16",
    borde: "border-[#b3773f]",
    texto: "text-[#b3773f]",
    sombra: "",
  },
};

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
      <div className="flex min-h-screen w-full items-center justify-center bg-[var(--dash-bg)] font-['Inter',sans-serif] text-[var(--dash-muted)]">
        Cargando ranking…
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

  const top3 = filas.slice(0, 3);
  const resto = filas.slice(3);

  return (
    <div className="min-h-screen w-full bg-[var(--dash-bg)]">
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 font-['Inter',sans-serif] text-[var(--dash-white)]">
        <header className="mb-8">
          <span className="mb-1 block font-mono text-xs uppercase tracking-widest text-[var(--dash-gold)]">
            Jornada {jornada.numero}
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">Tabla de Ganadores</h1>
        </header>

        {filas.length === 0 ? (
          <p className="text-sm text-[var(--dash-muted)]">
            Nadie ha enviado predicciones todavía.
          </p>
        ) : (
          <>
            {/* Podio: solo si hay al menos 3 jugadores */}
            {top3.length === 3 && (
              <div className="relative mb-8 overflow-hidden rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)]/50 p-6 pt-16 backdrop-blur-md md:pt-20">
                <div className="flex items-end justify-center gap-3 md:gap-6">
                  {top3.map((fila, i) => {
                    const posicion = i + 1;
                    const estilo = PODIO_ESTILO[posicion];
                    const esYo = fila.uid === usuario?.uid;
                    const nombre = usuarios[fila.uid] || "Jugador";

                    return (
                      <div
                        key={fila.uid}
                        className={`relative flex flex-col items-center ${estilo.ancho} ${estilo.orden}`}
                      >
                        <div className="absolute -top-16 flex flex-col items-center md:-top-20">
                          <div
                            className={`relative mb-2 flex items-center justify-center rounded-full border-2 bg-[var(--dash-surface-alt)] font-mono font-bold ${estilo.avatar} ${estilo.borde} ${estilo.sombra} ${estilo.texto}`}
                          >
                            {iniciales(nombre)}
                          </div>
                          <span
                            className={`w-full truncate text-center text-sm font-semibold ${
                              posicion === 1 ? estilo.texto : "text-[var(--dash-white)]"
                            }`}
                          >
                            {esYo ? "Tú" : nombre}
                          </span>
                          <span className={`text-lg font-extrabold ${estilo.texto}`}>
                            {fila.aciertos}
                          </span>
                        </div>

                        <div
                          className={`flex w-full items-start justify-center rounded-t-lg border-t-2 pt-2 backdrop-blur-sm ${estilo.alturaBarra} ${estilo.borde}`}
                          style={{
                            background:
                              posicion === 1
                                ? "linear-gradient(180deg, rgba(201,169,97,0.15) 0%, transparent 100%)"
                                : "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%)",
                          }}
                        >
                          <span className={`text-2xl font-extrabold opacity-40 ${estilo.texto}`}>
                            {posicion}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Lista del resto */}
            {resto.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="mb-1 flex items-center gap-4 px-4 font-mono text-[11px] uppercase tracking-wider text-[var(--dash-muted)]">
                  <span className="w-8 text-center">Pos</span>
                  <span className="flex-1">Jugador</span>
                  <span className="w-16 text-right">Aciertos</span>
                </div>
                {resto.map((fila, i) => {
                  const posicion = i + 4;
                  const esYo = fila.uid === usuario?.uid;
                  const nombre = usuarios[fila.uid] || "Jugador";

                  return (
                    <div
                      key={fila.uid}
                      className={`flex items-center gap-4 rounded-lg border p-3 backdrop-blur-md transition-colors ${
                        esYo
                          ? "border-[var(--dash-gold)]/40 bg-[var(--dash-gold-soft)]"
                          : "border-[var(--dash-border)] bg-[var(--dash-surface)]/50 hover:border-[var(--dash-gold)]/30"
                      }`}
                    >
                      <span className="w-8 text-center text-sm font-semibold text-[var(--dash-muted)]">
                        {posicion}
                      </span>
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface-alt)] font-mono text-xs font-bold text-[var(--dash-white)]">
                        {iniciales(nombre)}
                      </span>
                      <span className="flex-1 truncate text-sm font-medium">
                        {esYo ? "Tú" : nombre}
                      </span>
                      <span className="w-16 text-right text-base font-bold">
                        {fila.aciertos}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}