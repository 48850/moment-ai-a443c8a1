import { useState } from "react";
import { Send } from "lucide-react";

type Msg = { role: "user" | "ai"; text: string };

const seed: Msg[] = [
  { role: "ai", text: "Hey Alex — what's on your mind today? Stuck on the essay opener?" },
];

const Chat = () => {
  const [msgs, setMsgs] = useState<Msg[]>(seed);
  const [input, setInput] = useState("");

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg: Msg = { role: "user", text: input };
    setMsgs((m) => [...m, userMsg]);
    setInput("");
    setTimeout(() => {
      setMsgs((m) => [...m, { role: "ai", text: "(mock) Got it. Let's break that down into the next decisive move." }]);
    }, 600);
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] max-w-3xl flex-col">
      <div className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">/ chat</div>
        <h1 className="mt-1 font-display text-3xl tracking-tight">Talk it through</h1>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-border bg-background p-6">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
              m.role === "user" ? "bg-foreground text-background" : "bg-muted text-foreground"
            }`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={send} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-full border border-border bg-background px-5 py-3 text-sm focus:border-primary focus:outline-none"
        />
        <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm text-paper">
          <Send className="h-4 w-4" /> Send
        </button>
      </form>
    </div>
  );
};

export default Chat;
