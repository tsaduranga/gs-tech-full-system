"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type DashboardFooterContextValue = {
  footer: ReactNode;
  setFooter: (node: ReactNode) => void;
  clearFooter: () => void;
};

const DashboardFooterContext = createContext<DashboardFooterContextValue | null>(null);

export function DashboardFooterProvider({ children }: { children: ReactNode }) {
  const [footer, setFooterState] = useState<ReactNode>(null);

  const setFooter = useCallback((node: ReactNode) => {
    setFooterState(node);
  }, []);

  const clearFooter = useCallback(() => {
    setFooterState(null);
  }, []);

  const value = useMemo(
    () => ({ footer, setFooter, clearFooter }),
    [footer, setFooter, clearFooter]
  );

  return (
    <DashboardFooterContext.Provider value={value}>
      {children}
    </DashboardFooterContext.Provider>
  );
}

export function useDashboardFooter() {
  const ctx = useContext(DashboardFooterContext);
  if (!ctx) {
    throw new Error("useDashboardFooter must be used within DashboardFooterProvider");
  }
  return ctx;
}

/** Register page-specific footer content; cleared on unmount or when content is null. */
export function useSetDashboardFooter(content: ReactNode, deps: readonly unknown[]) {
  const { setFooter, clearFooter } = useDashboardFooter();

  useEffect(() => {
    if (content == null) {
      clearFooter();
      return;
    }
    setFooter(content);
    return clearFooter;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls refresh deps
  }, deps);
}
