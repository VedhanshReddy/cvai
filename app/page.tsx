"use client";

import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const login = async () => {
    try {
      await signInWithPopup(auth, provider);
      router.push("/chat");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-zinc-900 to-black text-white p-4">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-4xl font-bold">CVAi 🤖</h1>
        <p className="text-zinc-400 text-lg">
          Your own AI friend 🫱🏻‍🫲🏼 Chat now, clear doubts, just chill.
        </p>
        <button
          onClick={login}
          className="px-5 py-2 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 transition text-white font-medium shadow-xl backdrop-blur"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
