
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface LoginFormProps {
  onLogin: (email: string, password: string) => void | Promise<void>;
  onSendMagicLink: (email: string) => Promise<void>;
  canUseMagicLink: boolean;
  isLoading: boolean;
}

const LoginForm = ({ onLogin, onSendMagicLink, canUseMagicLink, isLoading }: LoginFormProps) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showMagicLinkInput, setShowMagicLinkInput] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [sendingMagicLink, setSendingMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  const handleMagicLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSendingMagicLink(true);

    void onSendMagicLink(magicLinkEmail)
      .then(() => {
        setMagicLinkSent(true);
      })
      .catch((error) => {
        setMagicLinkSent(false);
        toast.error(error instanceof Error ? error.message : t("auth.unableSendMagicLink"));
      })
      .finally(() => {
        setSendingMagicLink(false);
      });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input
          id="email"
          type="email"
          placeholder={t("auth.emailPlaceholder")}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          className="transition-all duration-200"
        />
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <a href="#" className="text-xs text-primary hover:underline">
            {t("auth.forgotPassword")}
          </a>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder={t("auth.passwordPlaceholder")}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="transition-all duration-200 pr-10"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword((previous) => !previous)}
            aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      
      <div className="pt-2 flex gap-2">
        <Button 
          type="submit" 
          disabled={isLoading || !email || !password}
          className="flex-1 transition-all duration-200 shadow-md hover:shadow-lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("auth.signingIn")}
            </>
          ) : (
            t("auth.signIn")
          )}
        </Button>
        
        <Button 
          type="button" 
          variant="outline" 
          className="flex-1 transition-all duration-200"
          disabled={!canUseMagicLink}
          onClick={() => setShowMagicLinkInput(!showMagicLinkInput)}
        >
          <Mail className="mr-2 h-4 w-4" />
          {t("auth.magicLinkSignInShort")}
        </Button>
      </div>
      </form>

      {!canUseMagicLink && (
        <p className="text-xs text-muted-foreground text-center">
          {t("auth.magicLinkHint")}
        </p>
      )}
      
      {showMagicLinkInput && (
        <div className="mt-4 p-4 border border-input rounded-lg bg-muted/50">
          {!magicLinkSent ? (
            <form onSubmit={handleMagicLinkSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="magic-link-email">{t("auth.enterEmail")}</Label>
                <Input
                  id="magic-link-email"
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  required
                  value={magicLinkEmail}
                  onChange={(e) => setMagicLinkEmail(e.target.value)}
                  disabled={sendingMagicLink}
                />
              </div>
              <Button 
                type="submit" 
                disabled={sendingMagicLink || !magicLinkEmail}
                className="w-full"
              >
                {sendingMagicLink ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("auth.sending")}
                  </>
                ) : (
                  t("auth.sendMagicLink")
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                {t("auth.magicLinkNote")}
              </p>
            </form>
          ) : (
            <div className="text-center">
              <Mail className="h-12 w-12 mx-auto text-primary mb-3" />
              <h3 className="font-medium text-lg">{t("auth.checkInbox")}</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                {t("auth.magicLinkSentTo")}<br />
                <span className="font-medium text-foreground">{magicLinkEmail}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {t("auth.noEmailHint")}
                <button 
                  type="button" 
                  className="text-primary ml-1 hover:underline"
                  onClick={() => setMagicLinkSent(false)}
                >
                  {t("auth.tryAgain")}
                </button>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LoginForm;
