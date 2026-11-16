import { createContext, useContext } from "react";

interface ShellCtx { openSettings: () => void; openHelp: () => void }
export const ShellContext = createContext<ShellCtx>({ openSettings: () => {}, openHelp: () => {} });
export const useShell = () => useContext(ShellContext);
