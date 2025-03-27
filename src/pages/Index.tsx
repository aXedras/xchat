
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import LoginForm from "@/components/LoginForm";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true);
    
    // Simulate API call
    try {
      // In a real app, this would be an actual API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Basic validation - in a real app this would be handled by the backend
      if (email === "demo@axedras.com" && password === "password") {
        toast.success("Login successful");
        navigate("/dashboard");
      } else {
        toast.error("Invalid credentials");
      }
    } catch (error) {
      toast.error("An error occurred during login");
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
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
        
        <LoginForm onLogin={handleLogin} isLoading={isLoading} />
        
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>Demo credentials</p>
          <p className="mt-1"><span className="font-medium">Email:</span> demo@axedras.com</p>
          <p><span className="font-medium">Password:</span> password</p>
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
