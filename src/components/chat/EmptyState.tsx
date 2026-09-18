
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

const EmptyState = () => {
  const { t } = useTranslation();

  return (
    <div className="flex-1 p-4 overflow-y-auto scroll-hidden bg-accent/10">
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Info className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">{t("chat.noMessages")}</h3>
        <p className="text-muted-foreground max-w-md mb-6">
          {t("chat.startHint")}
        </p>
      </div>
    </div>
  );
};

export default EmptyState;
