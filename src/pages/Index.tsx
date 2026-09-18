import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LoginForm from "@/components/LoginForm";
import { authService } from "@/services/authService";
import { logger } from "@/services/logger";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const Index = () => {
  const { t } = useTranslation();
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

    const unsubscribe = authService.subscribeAppAuth((identity) => {
      if (identity && !isCancelled) {
        navigate("/dashboard", { replace: true });
      }
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [navigate]);

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true);

    try {
      await authService.loginToApp(email, password);
      toast.success(t("auth.loginSuccess"));
      const targetPath =
        typeof location.state === "object" &&
        location.state &&
        "from" in location.state
          ? location.state.from?.pathname
          : undefined;
      navigate(targetPath || "/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("auth.loginError"),
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

      <div className="w-full max-w-md p-8 rounded-2xl animate-scale-in bg-gradient-to-br from-gold-light/70 via-white/90 to-platinum-light/70 backdrop-blur-md border border-gold/20 shadow-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-gold to-platinum flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-white">xC</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">xChat</h1>
          <p className="text-muted-foreground mt-2 text-center text-balance">
            {t("auth.tagline")}
          </p>
        </div>

        <LoginForm
          onLogin={handleLogin}
          onSendMagicLink={handleMagicLink}
          canUseMagicLink={authService.isSupabaseAuthConfigured()}
          isLoading={isLoading}
        />
      </div>

      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>xChat &copy; {new Date().getFullYear()}</p>
        <p className="mt-1">{t("auth.footerTagline")}</p>
      </footer>
    </div>
  );
};

export default Index;
