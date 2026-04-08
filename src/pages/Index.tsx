import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LoginForm from "@/components/LoginForm";
import config from "@/config/environment";
import { authService } from "@/services/authService";
import { logger } from "@/services/logger";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const maybeResumeSession = async () => {
      if (!authService.isSupabaseAuthConfigured()) {
        if (authService.isAppAuthenticated() && !isCancelled) {
          navigate("/dashboard", { replace: true });
        }
        return;
      }

      try {
        const identity = await authService.restoreAppSession();
        if (identity && !isCancelled) {
          navigate("/dashboard", { replace: true });
        }
      } catch (error) {
        logger.error("Session restore failed", { error });
      }
    };

    void maybeResumeSession();

    return () => {
      isCancelled = true;
    };
  }, [navigate]);

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true);

    try {
      await authService.loginToApp(email, password);
      toast.success("Login successful");
      const targetPath =
        typeof location.state === "object" &&
        location.state &&
        "from" in location.state
          ? location.state.from?.pathname
          : undefined;
      navigate(targetPath || "/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "An error occurred during login",
      );
      logger.error("Login failed", { error, email });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async (email: string) => {
    await authService.sendMagicLink(email);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-accent/30">
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] pointer-events-none" />

      <div className="w-full max-w-md p-8 glass-card rounded-2xl animate-scale-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-gold to-platinum flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-white">xC</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">xChat</h1>
          <p className="text-muted-foreground mt-2 text-center text-balance">
            Professional chat platform for the precious metals industry
          </p>
        </div>

        <LoginForm
          onLogin={handleLogin}
          onSendMagicLink={handleMagicLink}
          canUseMagicLink={authService.isSupabaseAuthConfigured()}
          isLoading={isLoading}
        />

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {config.demo.email && config.demo.password && (
            <>
              <p>Demo credentials</p>
              <p className="mt-1">
                <span className="font-medium">Email:</span> {config.demo.email}
              </p>
              <p>
                <span className="font-medium">Password:</span>{" "}
                {config.demo.password}
              </p>
            </>
          )}
          {config.auth.vendorAdmin.email &&
            config.auth.vendorAdmin.password && (
              <>
                <p className="mt-4">Vendor admin credentials</p>
                <p className="mt-1">
                  <span className="font-medium">Email:</span>{" "}
                  {config.auth.vendorAdmin.email}
                </p>
                <p>
                  <span className="font-medium">Password:</span>{" "}
                  {config.auth.vendorAdmin.password}
                </p>
                <p className="mt-1 text-xs">
                  Use this account to access the Admin Console and maintain
                  system settings.
                </p>
              </>
            )}
          {authService.isSupabaseAuthConfigured() && (
            <p className="mt-3">
              Supabase login and magic link are enabled for this environment.
            </p>
          )}
        </div>
      </div>

      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>xChat &copy; {new Date().getFullYear()}</p>
        <p className="mt-1">Connecting the precious metals industry securely</p>
      </footer>
    </div>
  );
};

export default Index;
