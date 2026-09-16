import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LANGUAGES, changeLanguage } from "@/i18n";

const LanguageToggle = () => {
  const { i18n, t } = useTranslation();

  const current =
    SUPPORTED_LANGUAGES.find((language) => language.code === i18n.language) ??
    SUPPORTED_LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-testid="language-toggle"
          aria-label={t("header.language")}
          className="text-primary-foreground hover:bg-gold-dark/20"
        >
          <span className="text-base leading-none">{current.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGUAGES.map((language) => (
          <DropdownMenuItem
            key={language.code}
            className="gap-2"
            onClick={() => changeLanguage(language.code)}
          >
            <span>{language.flag}</span>
            <span>{language.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageToggle;
