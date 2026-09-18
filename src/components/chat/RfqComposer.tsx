import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductClass, RfqTerms } from "@/types/chat";
import { useTranslation } from "react-i18next";

interface RfqComposerProps {
  disabled?: boolean;
  onSubmit: (terms: RfqTerms, content: string) => void;
}

const productClasses: ProductClass[] = ["gold", "silver", "platinum", "palladium", "other"];

const RfqComposer = ({ disabled, onSubmit }: RfqComposerProps) => {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState("");
  const [product, setProduct] = useState("");
  const [productCode, setProductCode] = useState("");
  const [productClass, setProductClass] = useState<ProductClass>("gold");
  const [quality, setQuality] = useState("");
  const [location, setLocation] = useState("");
  const [priceBasis, setPriceBasis] = useState("");
  const [premium, setPremium] = useState("");
  const [fees, setFees] = useState("");
  const [vat, setVat] = useState("");
  const [notes, setNotes] = useState("");
  const [ttl, setTtl] = useState("");
  const [content, setContent] = useState("");

  const productClassLabels: Record<ProductClass, string> = {
    gold: t("rfq.productClassGold"),
    silver: t("rfq.productClassSilver"),
    platinum: t("rfq.productClassPlatinum"),
    palladium: t("rfq.productClassPalladium"),
    other: t("rfq.productClassOther"),
  };

  const canSubmit =
    quantity.trim() &&
    product.trim() &&
    productCode.trim() &&
    quality.trim() &&
    location.trim() &&
    priceBasis.trim() &&
    premium.trim();

  const handleSubmit = () => {
    if (!canSubmit) return;
    const terms: RfqTerms = {
      quantity: quantity.trim(),
      product: product.trim(),
      productCode: productCode.trim(),
      productClass,
      quality: quality.trim(),
      location: location.trim(),
      priceBasis: priceBasis.trim(),
      premium: premium.trim(),
      fees: fees.trim() || null,
      vat: vat.trim() || null,
      notes: notes.trim() || null,
      rawTerms: `${quality.trim()} ${location.trim()} ${priceBasis.trim()} ${premium.trim()}`.trim(),
      responseTtlSeconds: ttl.trim() ? Number(ttl) : null,
    };
    onSubmit(
      terms,
      content.trim() ||
        `RFQ ${quantity.trim()} ${product.trim()} @ ${priceBasis.trim()} ${premium.trim()}`,
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="rfq-quantity">{t("rfq.quantity")}</Label>
          <Input id="rfq-quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="6x1KG" />
        </div>
        <div>
          <Label htmlFor="rfq-product">{t("rfq.product")}</Label>
          <Input id="rfq-product" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Gold" />
        </div>
        <div>
          <Label htmlFor="rfq-code">{t("rfq.productCodeLabel")}</Label>
          <Input id="rfq-code" value={productCode} onChange={(e) => setProductCode(e.target.value)} placeholder="XAU" />
        </div>
        <div>
          <Label htmlFor="rfq-class">{t("rfq.productClass")}</Label>
          <select
            id="rfq-class"
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={productClass}
            onChange={(e) => setProductClass(e.target.value as ProductClass)}
          >
            {productClasses.map((pc) => (
              <option key={pc} value={pc}>
                {productClassLabels[pc]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="rfq-quality">{t("rfq.quality")}</Label>
          <Input id="rfq-quality" value={quality} onChange={(e) => setQuality(e.target.value)} placeholder="LBMA good delivery" />
        </div>
        <div>
          <Label htmlFor="rfq-location">{t("rfq.location")}</Label>
          <Input id="rfq-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Zurich" />
        </div>
        <div>
          <Label htmlFor="rfq-basis">{t("rfq.priceBasis")}</Label>
          <Input id="rfq-basis" value={priceBasis} onChange={(e) => setPriceBasis(e.target.value)} placeholder="ZRH fixing" />
        </div>
        <div>
          <Label htmlFor="rfq-premium">{t("rfq.premium")}</Label>
          <Input id="rfq-premium" value={premium} onChange={(e) => setPremium(e.target.value)} placeholder="+0.25" />
        </div>
        <div>
          <Label htmlFor="rfq-fees">{t("rfq.fees")}</Label>
          <Input id="rfq-fees" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="20 bps" />
        </div>
        <div>
          <Label htmlFor="rfq-vat">{t("rfq.vat")}</Label>
          <Input id="rfq-vat" value={vat} onChange={(e) => setVat(e.target.value)} placeholder="exempt" />
        </div>
        <div>
          <Label htmlFor="rfq-ttl">{t("rfq.ttl")}</Label>
          <Input id="rfq-ttl" value={ttl} onChange={(e) => setTtl(e.target.value)} placeholder="900" inputMode="numeric" />
        </div>
        <div>
          <Label htmlFor="rfq-notes">{t("rfq.notes")}</Label>
          <Input id="rfq-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="same-day confirmation" />
        </div>
      </div>

      <div>
        <Label htmlFor="rfq-content">{t("rfq.message")}</Label>
        <textarea
          id="rfq-content"
          className="w-full chat-input min-h-[60px] p-3 resize-none"
          placeholder={t("rfq.optionalMessage")}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <Button disabled={!canSubmit || disabled} onClick={handleSubmit}>
          {t("rfq.sendRfq")}
        </Button>
      </div>
    </div>
  );
};

export default RfqComposer;
