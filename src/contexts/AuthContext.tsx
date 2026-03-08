"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

type Plan = "free" | "premium";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  plan: Plan;
  setPlan: (plan: Plan) => void;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  plan: "free",
  setPlan: () => {},
  getIdToken: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlanState] = useState<Plan>("free");

  useEffect(() => {
    const stored = localStorage.getItem("seniora_plan");
    if (stored === "premium" || stored === "free") {
      setPlanState(stored);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const setPlan = (p: Plan) => {
    setPlanState(p);
    localStorage.setItem("seniora_plan", p);
  };

  const getIdToken = async () => {
    if (!user) return null;
    return user.getIdToken();
  };

  return (
    <AuthContext.Provider value={{ user, loading, plan, setPlan, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
