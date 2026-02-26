import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface LiteModeContextType {
  liteMode: boolean;
  setLiteMode: (v: boolean) => void;
  toggleLiteMode: () => void;
}

const LiteModeContext = createContext<LiteModeContextType>({
  liteMode: false,
  setLiteMode: () => {},
  toggleLiteMode: () => {},
});

export const LiteModeProvider = ({ children }: { children: ReactNode }) => {
  const [liteMode, setLiteModeState] = useState(() => {
    try {
      return localStorage.getItem("pennyekart_lite_mode") === "true";
    } catch {
      return false;
    }
  });

  const setLiteMode = (v: boolean) => {
    setLiteModeState(v);
    try {
      localStorage.setItem("pennyekart_lite_mode", String(v));
    } catch {}
  };

  const toggleLiteMode = () => setLiteMode(!liteMode);

  return (
    <LiteModeContext.Provider value={{ liteMode, setLiteMode, toggleLiteMode }}>
      {children}
    </LiteModeContext.Provider>
  );
};

export const useLiteMode = () => useContext(LiteModeContext);
