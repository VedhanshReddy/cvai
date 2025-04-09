// lib/firestore.ts
import { doc, increment, updateDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase"; // ✅ Use exported db directly

const counterRef = doc(db, "stats", "counter");

export const incrementUsage = async () => {
  await updateDoc(counterRef, { count: increment(1) });
};

export const getUsage = async () => {
  const snap = await getDoc(counterRef);
  return snap.exists() ? snap.data().count : 0;
};
