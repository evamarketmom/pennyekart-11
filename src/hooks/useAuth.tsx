import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role_id: string | null;
  is_super_admin: boolean;
  is_approved: boolean;
  mobile_number: string | null;
  date_of_birth: string | null;
  user_type: string;
  local_body_id: string | null;
  ward_number: number | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const clearAuth = useCallback(() => {
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (error) {
        console.error("Failed to fetch profile:", error);
        if (mountedRef.current) setProfile(null);
        return;
      }
      if (mountedRef.current) setProfile(data as unknown as Profile | null);
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      if (mountedRef.current) setProfile(null);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Set up auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mountedRef.current) return;
        
        if (_event === 'SIGNED_OUT' || !newSession) {
          clearAuth();
          setLoading(false);
          return;
        }

        setSession(newSession);
        setUser(newSession.user);

        // Defer Supabase calls to avoid deadlock in onAuthStateChange
        setTimeout(() => {
          if (!mountedRef.current) return;
          // Update last_login_at on sign in
          if (_event === 'SIGNED_IN') {
            supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("user_id", newSession.user.id).then();
          }
          fetchProfile(newSession.user.id).finally(() => {
            if (mountedRef.current) setLoading(false);
          });
        }, 0);
      }
    );

    // Then get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (!mountedRef.current) return;

      if (error || !initialSession) {
        clearAuth();
        setLoading(false);
        return;
      }

      setSession(initialSession);
      setUser(initialSession.user);
      fetchProfile(initialSession.user.id).finally(() => {
        if (mountedRef.current) setLoading(false);
      });
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [clearAuth, fetchProfile]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // signOut may fail if session is already invalid, that's ok
    }
    clearAuth();
  }, [clearAuth]);

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
