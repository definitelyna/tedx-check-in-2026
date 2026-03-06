import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDSpMEXNXhh84baB-GHFlWhnbh6BYJ1Yqk",
  authDomain: "tedx-check-in-2026.firebaseapp.com",
  projectId: "tedx-check-in-2026",
  storageBucket: "tedx-check-in-2026.firebasestorage.app",
  messagingSenderId: "681278647502",
  appId: "1:681278647502:web:bac7421ed8c2b59cef749f",
  measurementId: "G-M2FFCJMJZ2",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export interface Attendee {
  id: string;
  name: string;
  email?: string | null;
  qr_code?: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
  ticket_number: string;
}
