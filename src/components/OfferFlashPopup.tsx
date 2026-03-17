import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, ChevronLeft, ChevronRight, Gift } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface FlashScreenItem {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string | null;
  sort_order: number;
}

interface PopupSettings {
  open_trigger: string;
  open_delay_seconds: number;
  auto_disappear_seconds: number;
}

const fetchFlashScreens = async (): Promise<FlashScreenItem[]> => {
  const { data } = await supabase
    .from("offer_flash_screens" as any)
    .select("id, title, image_url, link_url, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  return (data as any as FlashScreenItem[]) ?? [];
};

const fetchPopupSettings = async (): Promise<PopupSettings> => {
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["flash_popup_open_trigger", "flash_popup_open_delay", "flash_popup_auto_disappear"]);
  const map: Record<string, string> = {};
  (data ?? []).forEach((r) => { if (r.value) map[r.key] = r.value; });
  return {
    open_trigger: map["flash_popup_open_trigger"] || "refresh",
    open_delay_seconds: parseInt(map["flash_popup_open_delay"] || "2") || 2,
    auto_disappear_seconds: parseInt(map["flash_popup_auto_disappear"] || "0"),
  };
};

const OfferFlashPopup = () => {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(-1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const navigate = useNavigate();
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: screens = [] } = useQuery({
    queryKey: ["offer-flash-screens"],
    queryFn: fetchFlashScreens,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: popupSettings } = useQuery({
    queryKey: ["flash-popup-settings"],
    queryFn: fetchPopupSettings,
    staleTime: 5 * 60 * 1000,
  });

  // Pick a random starting screen
  useEffect(() => {
    if (screens.length > 0 && current === -1) {
      setCurrent(Math.floor(Math.random() * screens.length));
    }
  }, [screens.length, current]);

  // Auto-show logic based on settings
  useEffect(() => {
    if (screens.length === 0 || !popupSettings || current === -1) return;

    const delaySec = popupSettings.open_delay_seconds;

    if (popupSettings.open_trigger === "countdown") {
      setCountdown(delaySec);
    } else {
      const timer = setTimeout(() => setOpen(true), delaySec * 1000);
      return () => clearTimeout(timer);
    }
  }, [screens.length, popupSettings, current]);

  // Countdown ticker
  useEffect(() => {
    if (countdown === null || countdown <= 0) {
      if (countdown === 0) {
        setOpen(true);
        setCountdown(null);
      }
      return;
    }
    const id = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  // Auto-disappear when popup opens
  useEffect(() => {
    if (!open || !popupSettings || popupSettings.auto_disappear_seconds <= 0) return;
    autoCloseRef.current = setTimeout(() => {
      setOpen(false);
    }, popupSettings.auto_disappear_seconds * 1000);
    return () => {
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, [open, popupSettings]);

  const handleClick = (linkUrl: string | null) => {
    if (linkUrl) {
      setOpen(false);
      if (linkUrl.startsWith("http")) {
        window.open(linkUrl, "_blank");
      } else {
        navigate(linkUrl);
      }
    }
  };

  if (screens.length === 0 || current === -1) return null;

  const screen = screens[current];
  const hasMultiple = screens.length > 1;

  return (
    <>
      {/* Countdown overlay before popup opens */}
      {countdown !== null && countdown > 0 && (
        <div className="fixed bottom-20 right-3 z-50 md:bottom-6 md:right-6 bg-primary text-primary-foreground rounded-full h-12 w-12 flex items-center justify-center shadow-lg text-lg font-bold animate-pulse">
          {countdown}
        </div>
      )}

      {/* Floating button to reopen */}
      {!open && countdown === null && (
        <button
          onClick={() => { setCurrent(Math.floor(Math.random() * screens.length)); setOpen(true); }}
          className="fixed bottom-20 right-3 z-50 md:bottom-6 md:right-6 flex items-center justify-center h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg animate-bounce hover:animate-none transition-all"
          aria-label="View offers"
        >
          <Gift className="h-5 w-5" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 max-w-sm sm:max-w-md overflow-hidden border-0 bg-transparent shadow-none [&>button]:hidden">
          <div className="relative">
            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Auto-disappear progress bar */}
            {popupSettings && popupSettings.auto_disappear_seconds > 0 && open && (
              <div className="absolute top-0 left-0 right-0 z-10 h-1 rounded-t-xl overflow-hidden bg-black/20">
                <div
                  className="h-full bg-white/80 rounded-t-xl"
                  style={{
                    animation: `shrink ${popupSettings.auto_disappear_seconds}s linear forwards`,
                  }}
                />
                <style>{`@keyframes shrink { from { width: 100%; } to { width: 0%; } }`}</style>
              </div>
            )}

            {/* Banner image */}
            {screen.image_url ? (
              <img
                src={screen.image_url}
                alt={screen.title}
                className="w-full rounded-xl cursor-pointer"
                onClick={() => handleClick(screen.link_url)}
              />
            ) : (
              <div
                className="w-full aspect-[3/4] rounded-xl bg-gradient-to-br from-primary to-accent flex flex-col items-center justify-center cursor-pointer p-6"
                onClick={() => handleClick(screen.link_url)}
              >
                <Gift className="h-16 w-16 text-primary-foreground mb-4" />
                <h2 className="text-2xl font-bold text-primary-foreground text-center">{screen.title}</h2>
                <p className="text-primary-foreground/80 text-sm mt-2">Tap to explore</p>
              </div>
            )}

            {/* Navigation arrows */}
            {hasMultiple && (
              <>
                <button
                  onClick={() => setCurrent((c) => (c - 1 + screens.length) % screens.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrent((c) => (c + 1) % screens.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}

            {/* Dots */}
            {hasMultiple && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {screens.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`h-2 w-2 rounded-full transition-all ${i === current ? "bg-white w-4" : "bg-white/50"}`}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OfferFlashPopup;
