import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gift, Sparkles, Loader2 } from "lucide-react";
import { ScratchCard, useScratchCards } from "@/hooks/useScratchCards";
import { toast } from "@/hooks/use-toast";

interface Props {
  card: ScratchCard | null;
  onClose: () => void;
  onClaimed?: () => void;
}

const ScratchCardModal = ({ card, onClose, onClaimed }: Props) => {
  const { claim } = useScratchCards();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scratched, setScratched] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [reward, setReward] = useState<{
    amount: number;
    balance: number;
    reveal_text: string | null;
    reveal_image_url: string | null;
  } | null>(null);
  const drawingRef = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!card) {
      setScratched(false);
      setReward(null);
      setRevealing(false);
    }
  }, [card]);

  // Initialize scratch overlay
  useEffect(() => {
    if (!card || card.locked) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = c.width;
    const h = c.height;
    // Silver gradient overlay
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#c0c0c0");
    g.addColorStop(0.5, "#9ca3af");
    g.addColorStop(1, "#6b7280");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Hint text
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Scratch here!", w / 2, h / 2 - 4);
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText("Drag to reveal your reward", w / 2, h / 2 + 22);
  }, [card?.id, card?.locked]);

  const checkScratchPercent = () => {
    const c = canvasRef.current;
    if (!c) return 0;
    const ctx = c.getContext("2d");
    if (!ctx) return 0;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let cleared = 0;
    const total = data.length / 4;
    // Sample every 4th pixel for speed
    for (let i = 3; i < data.length; i += 16) {
      if (data[i] === 0) cleared++;
    }
    return (cleared * 4) / total;
  };

  const doClaim = async () => {
    if (!card || revealing) return;
    setRevealing(true);
    try {
      const res = await claim(card.id);
      setReward({
        amount: res.reward_amount,
        balance: res.balance,
        reveal_text: res.reveal_text,
        reveal_image_url: res.reveal_image_url,
      });
      onClaimed?.();
      // Fully clear canvas
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext("2d");
        ctx?.clearRect(0, 0, c.width, c.height);
      }
    } catch (e: any) {
      toast({
        title: "Claim failed",
        description: e?.message || "Please try again",
        variant: "destructive",
      });
      setRevealing(false);
    }
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const scaleX = c.width / rect.width;
    const scaleY = c.height / rect.height;
    let cx: number, cy: number;
    if ("touches" in e) {
      cx = e.touches[0].clientX;
      cy = e.touches[0].clientY;
    } else {
      cx = e.clientX;
      cy = e.clientY;
    }
    return { x: (cx - rect.left) * scaleX, y: (cy - rect.top) * scaleY };
  };

  const scratchAt = (x: number, y: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    if (lastPos.current) {
      ctx.lineWidth = 40;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    lastPos.current = { x, y };
  };

  const onStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (scratched || card?.locked) return;
    drawingRef.current = true;
    lastPos.current = null;
    const { x, y } = getPos(e);
    scratchAt(x, y);
  };

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    scratchAt(x, y);
  };

  const onEnd = () => {
    drawingRef.current = false;
    lastPos.current = null;
    if (scratched) return;
    const pct = checkScratchPercent();
    if (pct > 0.55) {
      setScratched(true);
      doClaim();
    }
  };

  if (!card) return null;

  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <DialogTitle className="sr-only">{card.title}</DialogTitle>
        <div className="p-6">
          <div className="text-center mb-4">
            <h3 className="text-xl font-bold">{card.title}</h3>
            {card.subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{card.subtitle}</p>
            )}
          </div>

          {card.locked ? (
            <div className="aspect-square rounded-2xl bg-muted/40 flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-muted-foreground/30">
              <Gift className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="font-semibold text-base">Keep your streak going!</p>
              <p className="text-sm text-muted-foreground mt-2">
                {card.streak_progress} / {card.streak_required} consecutive days completed
              </p>
              <div className="w-full bg-muted rounded-full h-2 mt-4 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all"
                  style={{
                    width: `${Math.min(100, ((card.streak_progress ?? 0) / (card.streak_required || 1)) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Add daily entries in "Today's Work" to unlock
              </p>
            </div>
          ) : (
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-primary to-accent shadow-xl">
              {/* Reward layer (under canvas) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-primary-foreground p-6 text-center">
                {reward ? (
                  <div className="animate-scale-in flex flex-col items-center">
                    <Sparkles className="h-10 w-10 mb-2 text-yellow-200" />
                    <p className="text-sm uppercase tracking-wider opacity-90">You won</p>
                    <p className="text-5xl font-bold my-2">₹{reward.amount}</p>
                    {reward.reveal_text && (
                      <p className="text-sm mt-2 opacity-90">{reward.reveal_text}</p>
                    )}
                    {reward.reveal_image_url && (
                      <img
                        src={reward.reveal_image_url}
                        alt=""
                        className="mt-3 max-h-24 rounded-lg"
                      />
                    )}
                    <p className="text-xs mt-3 opacity-75">
                      Wallet balance: ₹{reward.balance.toFixed(2)}
                    </p>
                  </div>
                ) : revealing ? (
                  <Loader2 className="h-10 w-10 animate-spin" />
                ) : (
                  <>
                    <Gift className="h-12 w-12 mb-3" />
                    <p className="text-2xl font-bold">₹{card.reward_amount}</p>
                    <p className="text-sm mt-1 opacity-90">Scratch to claim</p>
                  </>
                )}
              </div>

              {/* Scratch canvas overlay */}
              {!reward && (
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={400}
                  className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
                  onMouseDown={onStart}
                  onMouseMove={onMove}
                  onMouseUp={onEnd}
                  onMouseLeave={onEnd}
                  onTouchStart={onStart}
                  onTouchMove={onMove}
                  onTouchEnd={onEnd}
                />
              )}
            </div>
          )}

          <Button onClick={onClose} className="w-full mt-4" variant={reward ? "default" : "outline"}>
            {reward ? "Awesome!" : "Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScratchCardModal;
