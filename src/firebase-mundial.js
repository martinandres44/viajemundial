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
const tripRef = ref(db, 'mundial-2026');

export function onTripData(callback) {
  return onValue(tripRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data);
    }
  });
}

export async function saveTripData(data) {
  try {
    await set(tripRef, data);
  } catch (error) {
    console.error('Error guardando en Firebase:', error);
  }
}

export { db };
