import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authService } from "@/services/authService";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation();
  const [isCheckingSession, setIsCheckingSession] = useState(authService.isSupabaseAuthConfigured());
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAppAuthenticated());

  useEffect(() => {
    let isCancelled = false;

    const restoreSession = async () => {
      if (!authService.isSupabaseAuthConfigured()) {
        setIsAuthenticated(authService.isAppAuthenticated());
        setIsCheckingSession(false);
        return;
      }

      try {
        const identity = await authService.restoreAppSession();
        if (!isCancelled) {
          setIsAuthenticated(!!identity);
        }
      } catch {
        if (!isCancelled) {
          setIsAuthenticated(authService.isAppAuthenticated());
        }
      } finally {
        if (!isCancelled) {
          setIsCheckingSession(false);
        }
      }
    };

    void restoreSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  if (isCheckingSession) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
