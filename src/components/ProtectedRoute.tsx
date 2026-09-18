import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authService, AppAuthIdentity } from "@/services/authService";

interface ProtectedRouteProps {
  children: ReactNode;
  requireVendorAdmin?: boolean;
}

const ProtectedRoute = ({
  children,
  requireVendorAdmin = false,
}: ProtectedRouteProps) => {
  const location = useLocation();
  const [identity, setIdentity] = useState<AppAuthIdentity | null>(
    authService.getAppIdentity(),
  );
  const [isCheckingSession, setIsCheckingSession] = useState(
    authService.isSupabaseAuthConfigured(),
  );

  useEffect(() => {
    let isCancelled = false;

    const unsubscribe = authService.subscribeAppAuth((nextIdentity) => {
      if (!isCancelled) {
        setIdentity(nextIdentity);
        setIsCheckingSession(false);
      }
    });

    const restoreSession = async () => {
      if (!authService.isSupabaseAuthConfigured()) {
        if (!isCancelled) {
          setIdentity(authService.getAppIdentity());
          setIsCheckingSession(false);
        }
        return;
      }

      try {
        const restored = await authService.restoreAppSession();
        if (!isCancelled) {
          setIdentity(restored);
        }
      } catch {
        if (!isCancelled) {
          setIdentity(authService.getAppIdentity());
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
      unsubscribe();
    };
  }, []);

  if (isCheckingSession) {
    return null;
  }

  if (!identity) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (requireVendorAdmin && identity.role !== "vendor-admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
