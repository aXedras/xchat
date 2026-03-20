
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

interface LoginFormProps {
  onLogin: (email: string, password: string) => void | Promise<void>;
  onSendMagicLink: (email: string) => Promise<void>;
  canUseMagicLink: boolean;
  isLoading: boolean;
}

const LoginForm = ({ onLogin, onSendMagicLink, canUseMagicLink, isLoading }: LoginFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        toast.error(error instanceof Error ? error.message : "Unable to send magic link");
      })
      .finally(() => {
        setSendingMagicLink(false);
      });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="your.email@company.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          className="transition-all duration-200"
        />
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <a href="#" className="text-xs text-primary hover:underline">
            Forgot password?
          </a>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          className="transition-all duration-200"
        />
      </div>
      
      <div className="pt-2 flex flex-col gap-3">
        <Button 
          type="submit" 
          disabled={isLoading || !email || !password}
          className="w-full transition-all duration-200 shadow-md hover:shadow-lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>
        
        <Button 
          type="button" 
          variant="outline" 
          className="w-full transition-all duration-200"
          disabled={!canUseMagicLink}
          onClick={() => setShowMagicLinkInput(!showMagicLinkInput)}
        >
          <Mail className="mr-2 h-4 w-4" />
          Sign in with Magic Link
        </Button>
      </div>
      </form>

      {!canUseMagicLink && (
        <p className="text-xs text-muted-foreground text-center">
          Magic link login requires Supabase URL and a publishable key in the environment.
        </p>
      )}
      
      {showMagicLinkInput && (
        <div className="mt-4 p-4 border border-input rounded-lg bg-muted/50">
          {!magicLinkSent ? (
            <form onSubmit={handleMagicLinkSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="magic-link-email">Enter your email address</Label>
                <Input
                  id="magic-link-email"
                  type="email"
                  placeholder="your.email@company.com"
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
                    Sending...
                  </>
                ) : (
                  "Send Magic Link"
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                We'll send a secure login link to your email
              </p>
            </form>
          ) : (
            <div className="text-center">
              <Mail className="h-12 w-12 mx-auto text-primary mb-3" />
              <h3 className="font-medium text-lg">Check your inbox</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                We've sent a magic link to<br />
                <span className="font-medium text-foreground">{magicLinkEmail}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Didn't receive an email? Check your spam folder or
                <button 
                  type="button" 
                  className="text-primary ml-1 hover:underline"
                  onClick={() => setMagicLinkSent(false)}
                >
                  try again
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
