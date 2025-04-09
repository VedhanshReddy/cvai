// lib/db.ts
import { getFirestore, collection, addDoc, doc, getDocs, query, orderBy, setDoc } from "firebase/firestore";
import { auth } from "@/lib/firebase";

export const db = getFirestore();

export const saveMessage = async (threadId: string, sender: "user" | "bot", text: string) => {
  const user = auth.currentUser;
  if (!user) return;

  const msgRef = collection(db, "chats", user.uid, "threads", threadId, "messages");
  await addDoc(msgRef, {
    sender,
    text,
    timestamp: Date.now(),
  });
};

export const createNewThread = async () => {
  const user = auth.currentUser;
  if (!user) return;

  const threadRef = doc(collection(db, "chats", user.uid, "threads"));
  await setDoc(threadRef, {
    createdAt: Date.now(),
  });

  return threadRef.id;
};

export const getThreads = async () => {
  const user = auth.currentUser;
  if (!user) return [];

  const threadsSnap = await getDocs(
    query(collection(db, "chats", user.uid, "threads"), orderBy("createdAt", "desc"))
  );

  return threadsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};
