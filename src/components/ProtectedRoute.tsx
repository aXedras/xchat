import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authService } from "@/services/authService";

interface ProtectedRouteProps {
  children: ReactNode;
  requireVendorAdmin?: boolean;
}

const ProtectedRoute = ({
  children,
  requireVendorAdmin = false,
}: ProtectedRouteProps) => {
  const location = useLocation();
  const [isCheckingSession, setIsCheckingSession] = useState(
    authService.isSupabaseAuthConfigured(),
  );
  const [isAuthenticated, setIsAuthenticated] = useState(
    authService.isAppAuthenticated(),
  );
  const [isVendorAdmin, setIsVendorAdmin] = useState(
    authService.isVendorAdmin(),
  );

  useEffect(() => {
    let isCancelled = false;

    const restoreSession = async () => {
      if (!authService.isSupabaseAuthConfigured()) {
        setIsAuthenticated(authService.isAppAuthenticated());
        setIsVendorAdmin(authService.isVendorAdmin());
        setIsCheckingSession(false);
        return;
      }

      try {
        const identity = await authService.restoreAppSession();
        if (!isCancelled) {
          setIsAuthenticated(!!identity);
          setIsVendorAdmin(authService.isVendorAdmin());
        }
      } catch {
        if (!isCancelled) {
          setIsAuthenticated(authService.isAppAuthenticated());
          setIsVendorAdmin(authService.isVendorAdmin());
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

  if (requireVendorAdmin && !isVendorAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
