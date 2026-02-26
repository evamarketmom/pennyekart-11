import { useState, useEffect } from "react";
import logo from "@/assets/logo.png";

// Detect low-end devices
const isSlowDevice = () => {
  try {
    // Check for low memory (< 4GB) or slow CPU (< 4 cores)
    const nav = navigator as any;
    if (nav.deviceMemory && nav.deviceMemory < 4) return true;
    if (nav.hardwareConcurrency && nav.hardwareConcurrency < 4) return true;
    // Check for connection type
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (conn && (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g')) return true;
  } catch {
    // ignore
  }
  return false;
};

const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Skip splash entirely on slow devices
    if (isSlowDevice()) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => setFadeOut(true), 800);
    const remove = setTimeout(onComplete, 1200);
    return () => { clearTimeout(timer); clearTimeout(remove); };
  }, [onComplete]);

  // Don't render anything on slow devices
  if (isSlowDevice()) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-500 ${fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"}`}
    >
      <img
        src={logo}
        alt="Pennyekart"
        className="h-24 animate-scale-in"
      />
    </div>
  );
};

export default SplashScreen;
