// src/services/usuarios.js
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Busca un usuario en Firestore por su UID de Firebase Auth.
 * Regresa el documento si existe, o null si es la primera vez que entra.
 */
export async function obtenerUsuario(uid) {
  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * Crea el documento de usuario la primera vez que alguien se loguea.
 * Solo guarda lo básico; el nombre se completa después (ver Paso 2).
 */
export async function crearUsuarioSiNoExiste(uid, telefono) {
  const existente = await obtenerUsuario(uid);
  if (existente) return existente;

  const nuevoUsuario = {
    uid,
    nombre: "",
    telefono,
    registrado_en: serverTimestamp(),
    activo: true,
  };

  await setDoc(doc(db, "usuarios", uid), nuevoUsuario);
  return nuevoUsuario;
}

/**
 * Actualiza el nombre del usuario (usado en el formulario de "completa tu perfil").
 */
export async function actualizarNombre(uid, nombre) {
  await setDoc(doc(db, "usuarios", uid), { nombre }, { merge: true });
}