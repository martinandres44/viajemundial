// =============================================================
//  INSTRUCCIONES: Reemplazá los valores de abajo con los tuyos
//  (los sacás de la consola de Firebase, paso a paso en el README)
// =============================================================

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDYSb4OvCQeUXO2ZQg_X1goKEYL98M-cvE",
  authDomain: "miami-trip-planner.firebaseapp.com",
  databaseURL: "https://miami-trip-planner-default-rtdb.firebaseio.com",
  projectId: "miami-trip-planner",
  storageBucket: "miami-trip-planner.firebasestorage.app",
  messagingSenderId: "79120870143",
  appId: "1:79120870143:web:d96b9731e62e35f88dbaca"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Referencia principal donde se guarda todo el viaje
const tripRef = ref(db, 'miami-trip-2026');

/**
 * Escucha cambios en tiempo real de Firebase
 * @param {Function} callback - Recibe los datos actualizados
 * @returns {Function} unsubscribe
 */
export function onTripData(callback) {
  return onValue(tripRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data);
    }
  });
}

/**
 * Guarda todos los datos del viaje en Firebase
 * @param {Object} data - Datos completos del viaje
 */
export async function saveTripData(data) {
  try {
    await set(tripRef, data);
  } catch (error) {
    console.error('Error guardando en Firebase:', error);
  }
}

export { db };
