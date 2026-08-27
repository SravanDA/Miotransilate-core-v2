import { Button } from "../components/Button";

interface FixtureProps {
  t: (tagName: string) => string;
  hl: (tagName: string) => any;
}

export function PotsalesetFixture({ t, hl }: FixtureProps) {
  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="flex items-center gap-2 text-sm text-[#6B778C]">
        <span className="cursor-pointer hover:underline">Settings</span>
        <span>/</span>
        <span>Point of Sale</span>
      </div>

      <h1 className="text-2xl font-bold text-[#172B4D]">Invoice Configuration</h1>

      <div className="space-y-6">
        {/* Invoice Settings */}
        <div className="border border-[#DFE1E6] rounded p-6 bg-white shadow-sm">
          <h2 className="text-lg font-semibold text-[#172B4D] mb-1">Invoice Settings</h2>
          <p className="text-sm text-[#6B778C] mb-6">Configure general settings for the invoice</p>

          <div className="space-y-6">
            {[
              {
                title: "Round-off value",
                desc: "Round off the invoice value to the nearest whole number",
                active: true,
              },
              {
                title: t("POTSALESET_Invoice_Receipt_past_dates") !== "[POTSALESET_Invoice_Receipt_past_dates]" ? t("POTSALESET_Invoice_Receipt_past_dates") : "Invoice/Receipt for past dates",
                desc: "Allow the creation of invoices/recepit for past dates",
                active: true,
                tag: "POTSALESET_Invoice_Receipt_past_dates",
              },
              {
                title: "Item price adjustments",
                desc: "Allow staff to adjust prices for selected items, such as services, products, and packages",
                active: true,
              },
              {
                title: t("POTSALESET_Discount_before_tax") !== "[POTSALESET_Discount_before_tax]" ? t("POTSALESET_Discount_before_tax") : "Discount before tax",
                desc: "Apply discounts before tax for service and product sales",
                active: true,
                tag: "POTSALESET_Discount_before_tax",
              },
              {
                title: "Invoice preview",
                desc: "Show an invoice preview before generating the invoice",
                active: true,
              },
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-4">
                <div className={`w-10 h-5 rounded-full relative flex-shrink-0 cursor-pointer ${item.active ? 'bg-[#0052CC]' : 'bg-[#DFE1E6]'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${item.active ? 'left-[22px]' : 'left-0.5'}`} />
                </div>
                <div>
                  <div className="text-sm font-medium text-[#172B4D]" {...(item.tag ? hl(item.tag) : {})}>{item.title}</div>
                  <div className="text-sm text-[#6B778C]">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice Sequence */}
        <div className="border border-[#DFE1E6] rounded p-6 bg-white shadow-sm">
          <h2 className="text-lg font-semibold text-[#172B4D] mb-1">Invoice Sequence</h2>
          <p className="text-sm text-[#6B778C] mb-6">Configure invoice sequence number</p>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[#172B4D]">Reset invoice sequence instantly</div>
                <div className="text-sm text-[#6B778C]">Instantly reset the invoice sequence number to 1</div>
              </div>
              <Button variant="primary">Reset Now</Button>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-5 rounded-full relative flex-shrink-0 cursor-pointer bg-[#DFE1E6]">
                <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5" />
              </div>
              <div>
                <div className="text-sm font-medium text-[#172B4D]" {...hl("POTSALESET_Reset_invoice_sequence_automatically")}>
                  {t("POTSALESET_Reset_invoice_sequence_automatically") !== "[POTSALESET_Reset_invoice_sequence_automatically]" 
                    ? t("POTSALESET_Reset_invoice_sequence_automatically") 
                    : "Reset invoice sequence automatically"}
                </div>
                <div className="text-sm text-[#6B778C]">Automatically reset the invoice sequence number to 1 at the beginning of each month or year</div>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Prefix */}
        <div className="border border-[#DFE1E6] rounded p-6 bg-white shadow-sm">
          <h2 className="text-lg font-semibold text-[#172B4D] mb-1" {...hl("POTSALESET_Custom_Prefix")}>
            {t("POTSALESET_Custom_Prefix") !== "[POTSALESET_Custom_Prefix]" ? t("POTSALESET_Custom_Prefix") : "Custom Prefix"}
          </h2>
          <p className="text-sm text-[#6B778C]" {...hl("POTSALESET_Custom_Prefix_Desc")}>
            {t("POTSALESET_Custom_Prefix_Desc") !== "[POTSALESET_Custom_Prefix_Desc]" ? t("POTSALESET_Custom_Prefix_Desc") : "Configure custom prefix on the invoice number"}
          </p>
        </div>
      </div>
    </div>
  );
}
