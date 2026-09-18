import { useEffect, useState } from "react";
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
import { authService, AppAuthIdentity } from "@/services/authService";
import { useTranslation } from "react-i18next";
import LanguageToggle from "@/components/LanguageToggle";
import MetalPriceTicker from "@/components/MetalPriceTicker";

const Header = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [showSearch, setShowSearch] = useState(false);
  const [identity, setIdentity] = useState<AppAuthIdentity | null>(
    authService.getAppIdentity(),
  );

  useEffect(() => {
    return authService.subscribeAppAuth(setIdentity);
  }, []);

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
    <header className="border-b border-border shadow-md">
      <div className="h-16 flex items-center justify-between px-4 bg-gradient-to-r from-gold-light/90 via-gold/95 to-gold-dark/90 backdrop-blur-sm">
        <div className="flex items-center">
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleLogoClick}
          >
            <img
              src="/xChat.png"
              alt="xChat"
              className="h-8 w-8 rounded-full object-cover"
            />
            <span className="font-semibold text-lg text-primary-foreground">
              xChat
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <LanguageToggle />
          {showSearch ? (
            <div className="relative animate-fade-in">
              <Input
                placeholder={t("header.searchPlaceholder")}
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
                aria-label={t("header.openUserMenu")}
              >
                <Avatar>
                  {identity?.avatarUrl && (
                    <AvatarImage
                      src={identity.avatarUrl}
                      alt={identity.displayName}
                    />
                  )}
                  <AvatarFallback>{avatarFallback}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("header.myAccount")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {authService.isVendorAdmin() && (
                <DropdownMenuItem
                  className="gap-2"
                  onClick={() => navigate("/admin")}
                >
                  <Shield className="h-4 w-4" />
                  <span>{t("header.adminConsole")}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="gap-2"
                onClick={() => navigate("/profile")}
              >
                <User className="h-4 w-4" />
                <span>{t("header.profile")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2"
                onClick={() => void handleLogout()}
              >
                <LogOut className="h-4 w-4" />
                <span>{t("header.logout")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <MetalPriceTicker />
    </header>
  );
};

export default Header;
