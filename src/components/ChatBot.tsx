import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Mic, MicOff, Menu, Lock, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

type Message = { role: "user" | "assistant"; content: string };
type Command = { id: string; label: string; prompt: string; keyword?: string };
type Bootstrap = {
  loggedIn: boolean;
  mobile: string | null;
  isAgent: boolean;
  agentInfo: { name?: string | null; mobile?: string; source?: string } | null;
  elifeEnabled: boolean;
  pennyCommands: Command[];
  elifeCommands: Command[];
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const ChatBot = () => {
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [botName, setBotName] = useState("Penny Assistant");
  const [welcomeMessage, setWelcomeMessage] = useState("Hi! 👋 I'm Penny, your shopping assistant. How can I help you today?");
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  const hasSpeechSupport =
    typeof window !== "undefined" &&
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  // Fetch chatbot config (public)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("chatbot_config").select("key, value");
      if (data) {
        const map: Record<string, string | null> = {};
        data.forEach((r: any) => { map[r.key] = r.value; });
        if (map.enabled === "false") setEnabled(false);
        if (map.bot_name) setBotName(map.bot_name);
        if (map.welcome_message) setWelcomeMessage(map.welcome_message);
      }
    })();
  }, []);

  // Bootstrap commands + agent status whenever the chat opens with a logged-in user
  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("chatbot-bootstrap");
        if (error) throw error;
        setBootstrap(data as Bootstrap);
      } catch (e) {
        console.error("chatbot-bootstrap failed:", e);
      }
    })();
  }, [open, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const streamChat = useCallback(
    async (allMessages: Message[]) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }
      if (!resp.body) throw new Error("No response stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantSoFar = "";

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        const snap = assistantSoFar;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: snap } : m));
          }
          return [...prev, { role: "assistant", content: snap }];
        });
      };

      let done = false;
      while (!done) {
        const { done: rd, value } = await reader.read();
        if (rd) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || !line.trim()) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    },
    []
  );

  const send = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isLoading) return;
    setInput("");
    const userMsg: Message = { role: "user", content: msg };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setIsLoading(true);
    try {
      await streamChat(updated);
    } catch (e: any) {
      toast({ title: "Chat error", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const runCommand = (cmd: Command) => {
    void send(cmd.prompt);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SR();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  if (!enabled) return null;

  // Hide the floating bubble while auth is still loading to avoid a flash
  if (authLoading) return null;

  const loggedIn = !!user;
  const isAgent = bootstrap?.isAgent ?? false;
  const elifeCommands = bootstrap?.elifeCommands ?? [];
  const hasAnyCommands = elifeCommands.length > 0;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-50 md:bottom-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
          aria-label="Open chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-20 right-2 z-50 md:bottom-4 md:right-4 w-[calc(100vw-16px)] max-w-sm h-[70vh] max-h-[520px] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header / nav bar */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-primary text-primary-foreground rounded-t-2xl gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <MessageCircle className="w-5 h-5 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-heading font-semibold text-sm truncate">{botName}</span>
                {loggedIn && bootstrap && (
                  <span className="text-[10px] opacity-90 flex items-center gap-1 truncate">
                    {isAgent ? (
                      <>
                        <ShieldCheck className="w-3 h-3" />
                        Agent {bootstrap.agentInfo?.name ? `· ${bootstrap.agentInfo.name}` : ""}
                      </>
                    ) : (
                      "Customer mode"
                    )}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {loggedIn && hasAnyCommands && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-1.5 rounded-md hover:bg-primary-foreground/10 transition-colors"
                      aria-label="Commands menu"
                    >
                      <Menu className="w-5 h-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 max-h-[60vh] overflow-y-auto bg-background z-[60]">
                    <DropdownMenuLabel className="text-xs flex items-center gap-1">
                      WhatsApp Bot Commands
                      {isAgent && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">Agent</Badge>
                      )}
                    </DropdownMenuLabel>
                    {elifeCommands.map((c, idx) => (
                      <DropdownMenuItem key={c.id} onSelect={() => runCommand(c)} className="text-sm">
                        <span className="font-mono mr-2 text-xs text-muted-foreground w-5 shrink-0">{idx + 1}</span>
                        <span className="truncate">{c.label}</span>
                      </DropdownMenuItem>
                    ))}
                    {bootstrap?.elifeEnabled && !isAgent && (
                      <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                          Some commands may require an e-Life agent account to run.
                        </div>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="p-1.5 rounded-md hover:bg-primary-foreground/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          {!loggedIn ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Lock className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-foreground font-medium">Please log in to use the assistant</p>
              <p className="text-xs text-muted-foreground">
                The assistant is personalised — it needs to know who you are to help with orders, wallet, and agent tasks.
              </p>
              <Link
                to="/customer/login"
                onClick={() => setOpen(false)}
                className="mt-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
              >
                Log in
              </Link>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center mt-6 space-y-3">
                    <p className="text-muted-foreground text-sm">{welcomeMessage}</p>
                    {hasAnyCommands && (
                      <p className="text-[11px] text-muted-foreground">
                        Tip: tap the <Menu className="w-3 h-3 inline" /> menu above for quick commands.
                      </p>
                    )}
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {m.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert [&>p]:m-0">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        m.content
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-xl px-3 py-2 text-sm text-muted-foreground animate-pulse">
                      Thinking…
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-border px-3 py-2 flex items-center gap-2">
                {hasSpeechSupport && (
                  <button
                    onClick={toggleListening}
                    className={`p-2 rounded-full transition-colors ${
                      isListening
                        ? "bg-destructive text-destructive-foreground animate-pulse"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    aria-label={isListening ? "Stop listening" : "Start voice input"}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                )}
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder="Type a message…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  disabled={isLoading}
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || isLoading}
                  className="p-2 text-primary disabled:opacity-40"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default ChatBot;
