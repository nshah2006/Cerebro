import { createContext, useContext, useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "hackai_selected_topics";

const TopicsContext = createContext(null);

export function TopicsProvider({ children }) {
  const [topics, setTopicsState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      if (topics.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(topics));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }, [topics]);

  const setTopics = useCallback((next) => {
    setTopicsState((prev) => (typeof next === "function" ? next(prev) : next));
  }, []);

  return (
    <TopicsContext.Provider value={{ topics, setTopics }}>
      {children}
    </TopicsContext.Provider>
  );
}

export function useTopics() {
  const ctx = useContext(TopicsContext);
  if (!ctx) return { topics: [], setTopics: () => {} };
  return ctx;
}
