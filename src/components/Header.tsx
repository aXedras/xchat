import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Search, Bell, Shield, User, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authService } from "@/services/authService";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSearch, setShowSearch] = useState(false);
  const identity = authService.getAppIdentity();
  const avatarFallback =
    identity?.displayName
      ?.split(" ")
      .filter(Boolean)
      .map((token) => token[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "XC";

  const handleLogout = async () => {
    await authService.logoutApp();
    navigate("/");
  };

  const handleLogoClick = () => {
    if (location.pathname === "/") {
      return;
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <header className="h-16 border-b border-border flex items-center justify-between px-4 bg-gradient-to-r from-gold-light/90 via-gold/95 to-gold-dark/90 backdrop-blur-sm shadow-md">
      <div className="flex items-center">
        <div
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleLogoClick}
        >
          <div className="h-8 w-8 rounded-full bg-gradient-to-r from-gold-dark to-platinum flex items-center justify-center">
            <span className="text-sm font-bold text-white">xC</span>
          </div>
          <span className="font-semibold text-lg text-primary-foreground">
            xChat
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {showSearch ? (
          <div className="relative animate-fade-in">
            <Input
              placeholder="Search messages..."
              className="w-64 pl-9"
              autoFocus
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 hover:bg-gold-dark/20"
              onClick={() => setShowSearch(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-gold-dark/20"
            onClick={() => setShowSearch(true)}
          >
            <Search className="h-5 w-5" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="text-primary-foreground hover:bg-gold-dark/20"
        >
          <Bell className="h-5 w-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8 p-0"
              aria-label="Open user menu"
            >
              <Avatar>
                <AvatarImage src="https://source.unsplash.com/random/40x40/?portrait" />
                <AvatarFallback>{avatarFallback}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {authService.isVendorAdmin() && (
              <DropdownMenuItem
                className="gap-2"
                onClick={() => navigate("/admin")}
              >
                <Shield className="h-4 w-4" />
                <span>Admin Console</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="gap-2"
              onClick={() => navigate("/profile")}
            >
              <User className="h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2"
              onClick={() => void handleLogout()}
            >
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
