
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Loader2 } from "lucide-react";

interface LoginFormProps {
  onLogin: (email: string, password: string) => void;
  isLoading: boolean;
}

const LoginForm = ({ onLogin, isLoading }: LoginFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showQrScanner, setShowQrScanner] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
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
          onClick={() => setShowQrScanner(!showQrScanner)}
        >
          <QrCode className="mr-2 h-4 w-4" />
          Sign in with QR Code
        </Button>
      </div>
      
      {showQrScanner && (
        <div className="mt-4 p-4 border border-input rounded-lg bg-muted/50 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            QR Code login is not available in this demo
          </p>
          <div className="w-32 h-32 mx-auto border-2 border-dashed border-muted-foreground/40 rounded flex items-center justify-center">
            <span className="text-xs text-muted-foreground">QR Scanner Placeholder</span>
          </div>
        </div>
      )}
    </form>
  );
};

export default LoginForm;
