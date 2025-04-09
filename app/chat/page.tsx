"use client";

import { useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Image from "next/image";
import {
  collection,
  addDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc,
  runTransaction,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  Pencil,
  Trash,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  LogOut,
  SendHorizonal,
  MoreVertical,
  Moon,
  Sun,
} from "lucide-react";

type ChatMessage = {
  sender: "user" | "bot";
  text: string;
};

export default function Chat() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [globalCount, setGlobalCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [typingText, setTypingText] = useState("");
  const [showBotOptions, setShowBotOptions] = useState(false);
  const botSelectorRef = useRef(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [secretCode, setSecretCode] = useState("");
  const ENV_SECRET_CODE = process.env.NEXT_PUBLIC_SECRET_CODE;
  const [confirmedCode, setConfirmedCode] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [userCount, setUserCount] = useState(0);
  const [globalUsage, setGlobalUsage] = useState<number>(0);
  const [botDropdownPosition, setBotDropdownPosition] = useState<"sidebar" | "empty" | null>(null);


  useEffect(() => {
    const fetchGlobalUsage = async () => {
      const docRef = doc(db, "meta", "counter"); // ✅ match this with where you're updating
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setGlobalUsage(docSnap.data().count || 0);
      }
    };
  
    fetchGlobalUsage();
  }, []);
  

  useEffect(() => {
    const theme = localStorage.getItem("theme");
    setDarkMode(theme === "dark");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/");
      } else {
        setUser(currentUser);
  
        // 1. Listen to chats
        const chatQuery = query(
          collection(db, "users", currentUser.uid, "chats"),
          orderBy("createdAt", "desc")
        );
        const unsubChats = onSnapshot(chatQuery, (snapshot) => {
          const chatList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setChats(chatList);
        });
  
        // 2. Listen to global counter
        const unsubCounter = onSnapshot(doc(db, "meta", "counter"), (docSnap) => {
          if (docSnap.exists()) {
            setGlobalCount(docSnap.data().count);
          }
        });
  
        // 3. Fetch user's total message count
        const fetchUserMessageCount = async () => {
          let total = 0;
          const userChatsSnap = await getDocs(collection(db, "users", currentUser.uid, "chats"));
          for (const chatDoc of userChatsSnap.docs) {
            const messagesSnap = await getDocs(
              collection(db, "users", currentUser.uid, "chats", chatDoc.id, "messages")
            );
            total += messagesSnap.size;
          }
          setUserCount(total);
        };
  
        fetchUserMessageCount();
  
        return () => {
          unsubChats();
          unsubCounter();
        };
      }
    });
  
    return () => unsub();
  }, []);
  

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing, typingText]);

  useEffect(() => {
    if (activeChatId && user) {
      const q = query(collection(db, "users", user.uid, "chats", activeChatId, "messages"), orderBy("createdAt"));
      const unsub = onSnapshot(q, (snapshot) => {
        const chatMsgs: any[] = [];
        snapshot.forEach((doc) => {
          const { messages: msgs } = doc.data();
          if (msgs) chatMsgs.push(...msgs);
        });
        setMessages(chatMsgs);
      });
      return () => unsub();
    }
  }, [activeChatId, user]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        botSelectorRef.current &&
        !(botSelectorRef.current as any).contains(e.target)
      ) {
        setShowBotOptions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || !activeChatId) return;
  
    const userMsg: ChatMessage = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    setTypingText("");
  
    const controller = new AbortController(); // 🔥 Create AbortController
    setAbortController(controller); // Save it for Stop button
  
    try {
      const activeChat = chats.find((c) => c.id === activeChatId);
      const code = confirmedCode || secretCode;
  
      if (activeChat?.type === "max") {
        if (!code) {
          alert("Please enter the secret code.");
          setTyping(false);
          setShowCodeModal(true);
          return;
        }
        if (code !== ENV_SECRET_CODE) {
          alert("Incorrect secret code.");
          setTyping(false);
          return;
        }
        if (code !== confirmedCode) {
          alert("Please confirm the code.");
          setTyping(false);
          return;
        }
  
        console.log("Code confirmed, proceeding with message sending.");
      }
  
      let data;
  
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          body: JSON.stringify({
            prompt: input,
            type: activeChat?.type || "normal",
            code,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });
  
        if (!res.ok) {
          const errorData = await res.json();
          if (errorData.error?.includes("Mistral API error") || res.status === 500) {
            alert("🚧 AI is currently being updated. Try again in a few minutes!");
          } else {
            alert(errorData.error || "Something went wrong!");
          }
          setTyping(false);
          setTypingText("");
          return;
        }
  
        data = await res.json();
  
      } catch (err: any) {
        console.error("🔌 AI server offline:", err.message);
        alert("🛠️ Our AI is currently offline. We’re doing some updates. Check back soon!");
        setTyping(false);
        setTypingText("");
        return;
      }
  
      const fullResponse = data.response;
  
      let currentText = "";
      for (let i = 0; i < fullResponse.length; i++) {
        await new Promise((r) => setTimeout(r, 15));
        currentText += fullResponse[i];
        setTypingText(currentText);
      }
  
      const botMsg: ChatMessage = { sender: "bot", text: fullResponse };
      setMessages((prev) => [...prev, botMsg]);
  
      await addDoc(collection(db, "users", user.uid, "chats", activeChatId, "messages"), {
        user: user?.email,
        messages: [userMsg, botMsg],
        createdAt: serverTimestamp(),
      });
  
      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, "meta", "counter");
        const counterSnap = await transaction.get(counterRef);
  
        if (!counterSnap.exists()) {
          transaction.set(counterRef, { count: 1 });
        } else {
          const currentCount = counterSnap.data().count || 0;
          transaction.update(counterRef, { count: currentCount + 1 });
        }
      });
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("🛑 Bot response stopped by user.");
      } else {
        console.error("Send message failed:", error);
      }
    }
  
    setTyping(false);
    setTypingText("");
    setAbortController(null); // clear controller
  };
  
  

  const createNewChat = async (type: "normal" | "max" = "normal") => {
    if (type !== "max") setConfirmedCode(null);
    const userChatsRef = collection(db, "users", user.uid, "chats");
    const newChat = await addDoc(userChatsRef, {
      user: user.email,
      title: "Untitled Chat",
      type,
      createdAt: serverTimestamp(),
    });
    setActiveChatId(newChat.id);
    setMessages([]);
    setSecretCode(""); // Clear after use
  };

  const deleteChat = async (id: string) => {
    await deleteDoc(doc(db, "users", user.uid, "chats", id));
    if (id === activeChatId) {
      setActiveChatId(null);
      setMessages([]);
    }
  };

  const renameChat = async (id: string, title: string) => {
    await updateDoc(doc(db, "users", user.uid, "chats", id), { title });
    setEditingId(null);
  };

  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
    setShowMenu(false);
  };

  const handleSignOut = () => {
    signOut(auth);
    router.push("/");
  };

  const handleMaxBotConfirm = () => {
    const correctCode = process.env.NEXT_PUBLIC_MAX_BOT_CODE || "123";
  
    if (secretCode.trim() === correctCode) {
      console.log("✅ Correct code:", secretCode);
      setConfirmedCode(secretCode); // ✅ Save it here
      createNewChat("max");
      setShowCodeModal(false);
      setSecretCode("");
    } else {
      alert("❌ Incorrect code. Try again!");
    }
  };  

  const activeChat = chats.find((chat) => chat.id === activeChatId);

  return (
    <div className="h-screen w-full flex bg-white dark:bg-black text-black dark:text-white transition-colors overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 md:hidden z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}
  
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="fixed md:relative z-30 inset-y-0 left-0 w-64 border-r border-white/10 bg-zinc-100 dark:bg-zinc-900 p-4 space-y-4 transition-all md:block">
          <div className="flex items-center gap-2">
            <div className="relative w-full bot-selector" ref={botSelectorRef}>
            <button
                onClick={() => {
                  setBotDropdownPosition(botDropdownPosition === "sidebar" ? null : "sidebar");
                }}
                className="w-full py-2 bg-blue-600 rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2 text-white"
              >
                <Plus size={16} /> New Chat
              </button>
  
                        {botDropdownPosition === "sidebar" && (
            <div className="absolute top-full mt-2 w-full space-y-1 bg-white dark:bg-zinc-800 rounded-xl shadow-xl z-20">
              {/* Normal Bot */}
              <button
                onClick={() => {
                  createNewChat("normal");
                  setBotDropdownPosition(null);
                  setSidebarOpen(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition"
              >
                💬 Normal Bot
              </button>

              {/* Max Bot */}
              <button
                onClick={() => {
                  setSecretCode("");
                  setShowCodeModal(true);
                  setBotDropdownPosition(null);
                }}
                className="w-full text-left px-4 py-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition"
              >
                🧠 Max Bot
              </button>
            </div>
          )}
            </div>
  
            <button
              className="p-2 rounded-full bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
              onClick={() => setSidebarOpen(false)}
            >
              <ChevronsRight size={20} />
            </button>
          </div>
  
          <div className="space-y-2 overflow-y-auto max-h-[70vh]">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`flex items-center justify-between p-2 rounded-xl cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800 transition ${
                  activeChatId === chat.id ? "bg-zinc-300 dark:bg-zinc-700" : ""
                }`}
                onClick={() => setActiveChatId(chat.id)}
              >
                {editingId === chat.id ? (
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onBlur={() => renameChat(chat.id, newTitle)}
                    autoFocus
                    className="bg-zinc-800 text-white px-2 py-1 rounded w-full"
                  />
                ) : (
                  <>
                    <span className="truncate max-w-[70%]">{chat.title || "Chat"}</span>
                    <div className="flex items-center gap-1">
                      <Pencil
                        size={16}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(chat.id);
                          setNewTitle(chat.title || "");
                        }}
                        className="hover:text-blue-500 cursor-pointer"
                      />
                      <Trash
                        size={16}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChat(chat.id);
                        }}
                        className="text-red-500 hover:text-red-700 cursor-pointer"
                      />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
        {/* Chat Area */}
<div className="flex-1 flex flex-col overflow-hidden">
  {/* Header */}
  <div className="flex items-center justify-between p-4 border-b border-white/10 bg-zinc-100/70 dark:bg-zinc-900/70 backdrop-blur">
    <div className="flex items-center gap-3">
      {/* Sidebar toggle button (always visible now) */}
      <button
        className="p-2 rounded-full bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <ChevronsLeft size={20} />
      </button>
      {/* Title */}
      <div className="text-xl font-bold">CVAi</div>
    </div>

    {/* Global usage count */}
    <p className="text-sm text-gray-500 dark:text-gray-400">
      🌍 Global usage count: {globalUsage}
    </p>

    {/* Right-side menu */}
    <div className="flex items-center gap-3 relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
      >
        <MoreVertical size={20} />
      </button>

      {showMenu && (
        <div className="absolute right-10 top-10 bg-zinc-100 dark:bg-zinc-800 border border-white/10 rounded-xl shadow-lg p-4 w-56 z-10 space-y-2">
          <button
            onClick={toggleTheme}
            className="w-full text-left px-3 py-2 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-lg transition flex items-center gap-2"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            {darkMode ? "Light Mode" : "Dark Mode"}
          </button>
          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-lg transition flex items-center gap-2"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      )}

      {user?.photoURL && (
        <Image
          src={user.photoURL}
          alt="Profile"
          width={36}
          height={36}
          className="rounded-full border border-white/10"
        />
      )}
    </div>
  </div>

        
        {/* Chat Title or Welcome */}
{!activeChat ? (
  <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 text-center space-y-4">
    <h1 className="text-4xl font-bold">CVAi 🤖</h1>
    <p className="text-zinc-400 text-lg max-w-md">
      Your own AI friend 🫱🏻‍🫲🏼 Chat now, clear doubts, just chill.
    </p>
    <button
  onClick={() => {
    setBotDropdownPosition(botDropdownPosition === "empty" ? null : "empty");
  }}
  className="mt-4 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl shadow-md hover:from-blue-700 hover:to-blue-600 transition-all duration-200"
>
  <Plus size={18} />
  <span className="font-medium text-sm">New Chat</span>
</button>

{botDropdownPosition === "empty" && (
  <div className="mt-4 space-y-2 bg-white dark:bg-zinc-800 rounded-xl shadow-xl p-4 w-full max-w-xs mx-auto z-20">
    <button
      onClick={() => {
        createNewChat("normal");
        setBotDropdownPosition(null);
      }}
      className="w-full text-left px-4 py-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition"
    >
      💬 Normal Bot
    </button>
    <button
      onClick={() => {
        setSecretCode("");
        setShowCodeModal(true);
        setBotDropdownPosition(null);
      }}
      className="w-full text-left px-4 py-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition"
    >
      🧠 Max Bot
    </button>
  </div>
)}

  </div>
) : (
  <>
    {/* Chat Title */}
    <div className="text-center font-bold text-lg py-3 border-b border-white/10 bg-zinc-50/30 dark:bg-zinc-950/30">
      <span className="mr-1">{activeChat.type === "max" ? "MAX: " : "NORMAL: "}</span>
      {activeChat.title}
    </div>

    {/* Messages */}
    <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-8">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`w-full max-w-3xl mx-auto mb-4 ${
            msg.sender === "user" ? "flex justify-end" : "flex justify-start"
          }`}
        >
          <div className="space-y-1 max-w-full">
            <span className="block font-semibold text-sm text-zinc-400">
              {msg.sender === "user" ? "You:" : "Bot:"}
            </span>
            <div
              className={`inline-block px-4 py-2 rounded-xl text-base leading-relaxed whitespace-pre-wrap ${
                msg.sender === "user"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white"
                  : "text-zinc-800 dark:text-zinc-100"
              }`}
            >
              {msg.text}
            </div>
          </div>
        </div>
      ))}

      {typing && (
        <div className="w-full max-w-3xl mx-auto text-left text-zinc-500 dark:text-zinc-400 space-y-2">
          <div>
            <span className="block font-semibold mb-1 text-sm text-zinc-400">Bot:</span>
            <div className="animate-pulse">{typingText || "Thinking..."}</div>
          </div>
          <button
            onClick={() => {
              abortController?.abort();
              setTyping(false);
              setTypingText("⏹️ Stopped");
              setTimeout(() => setTypingText(""), 2000);
            }}
            className="px-4 py-1 bg-red-500 text-white text-sm rounded-full hover:bg-red-600 transition"
          >
            🛑 Stop Generating
          </button>
        </div>
      )}
      <div ref={bottomRef}></div>
    </div>

    {/* Chat Input */}
    <div className="w-full px-4 pb-6">
      <div className="max-w-3xl mx-auto relative flex items-center bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-2xl shadow-2xl p-2 pl-4 transition-all">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Adugu ra bro..."
          className="flex-1 min-w-0 bg-transparent text-black dark:text-white placeholder-zinc-500 outline-none pr-12 rounded-xl"
        />
        <button
          onClick={sendMessage}
          className="absolute right-0.5 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 transition"
        >
          <SendHorizonal size={18} />
        </button>
      </div>
    </div>
  </>
)}
</div>
  
      {/* Max Bot Code Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-xl w-[90%] max-w-md space-y-4">
            <h2 className="text-lg font-semibold text-center">Enter Secret Code 🔐</h2>
            <input
              type="password"
              value={secretCode}
              onChange={(e) => setSecretCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleMaxBotConfirm()}
              autoFocus
              placeholder="Enter code here..."
              className="w-full px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-center text-zinc-500">Entered code: <span className="font-mono">{secretCode}</span></p>
            <p className="text-sm text-center text-zinc-500">This code is required to access the Max Bot. Please enter it carefully.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowCodeModal(false);
                  setSecretCode("");
                }}
                className="px-4 py-2 rounded-lg bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleMaxBotConfirm}
                disabled={!secretCode.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}  
