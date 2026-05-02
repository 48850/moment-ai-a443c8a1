import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { chatMock, type ChatMessage, type ScheduleBlock } from "@/lib/mockData";

const DayPlanRenderer = ({ blocks, onSendMessage }: { blocks: ScheduleBlock[]; onSendMessage: (t: string) => void }) => {
  const [note, setNote] = useState("");
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background/40">
      <div className="border-b border-border px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Today's plan
      </div>
      <ul className="divide-y divide-border">
        {blocks.map((b) => (
          <li key={b.id} className={`flex items-center gap-3 px-3 py-2 text-xs ${b.decisive ? "border-l-2 border-l-primary" : ""}`}>
            <span className="w-20 font-mono text-muted-foreground">{b.start_time}</span>
            <span className="flex-1">{b.title}</span>
            {b.decisive && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] text-primary">best next</span>}
          </li>
        ))}
      </ul>
      <div className="border-t border-border p-3">
        <div className="text-xs text-muted-foreground">What feels unrealistic?</div>
        <div className="mt-2 flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. I'm low energy after school"
            className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <button
            onClick={() => {
              if (!note.trim()) return;
              onSendMessage(`What feels unrealistic: ${note}`);
              setNote("");
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

const TypingDots = () => (
  <div className="inline-flex items-center gap-1 rounded-2xl bg-secondary px-3 py-2">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
        style={{ animationDelay: `${i * 120}ms` }}
      />
    ))}
  </div>
);

const Chat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(chatMock);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const onSendMessage = (text: string) => {
    if (!text.trim()) return;
    const user: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((m) => [...m, user]);
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: "(mock) Got it. Let's break that down into the next decisive move." },
      ]);
    }, 700);
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-2xl flex-col md:h-[calc(100vh-7rem)]">
      <div className="mb-3">
        <div className="text-xs text-muted-foreground">/ chat</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Talk it through</h1>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card p-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] ${m.role === "user" ? "" : "w-full"}`}>
              <div
                className={`rounded-2xl px-3.5 py-2 text-sm ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                }`}
              >
                {m.content}
              </div>
              {m.renderedResponse?.type === "day_plan" && (
                <DayPlanRenderer blocks={m.renderedResponse.blocks} onSendMessage={onSendMessage} />
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <TypingDots />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSendMessage(input);
          setInput("");
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Moment…"
          className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};

export default Chat;
