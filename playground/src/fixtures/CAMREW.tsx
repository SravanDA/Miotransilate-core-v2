import { MessageSquare } from "lucide-react";

interface FixtureProps {
  t: (tagName: string) => string;
  hl: (tagName: string) => any;
}

export function CamrewFixture({ t, hl }: FixtureProps) {
  const toggles = [
    { id: "CAMREW_6", defaultLabel: "Reward Points" },
    { id: "CAMREW_7", defaultLabel: "Round off points" },
    { id: "CAMREW_8", defaultLabel: "Reward point for services" },
    { id: "CAMREW_9", defaultLabel: "Reward point for products" },
    { id: "CAMREW_10", defaultLabel: "Reward point for packages" },
    { id: "CAMREW_11", defaultLabel: "Reward point for membership" },
    { id: "CAMREW_12", defaultLabel: "Reward point for membership customer" },
    { id: "CAMREW_13", defaultLabel: "Reward point for prepaid" },
    { id: "CAMREW_14", defaultLabel: "Reward point for gift voucher" },
    { id: "CAMREW_15", defaultLabel: "Reward point for tax" },
  ];

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="flex items-center gap-2 text-sm text-[#6B778C]">
        <span className="cursor-pointer hover:underline" {...hl("SERSET_1")}>{t("SERSET_1")}</span>
        <span>/</span>
        <span className="text-[#6B778C]" {...hl("CAMREW_5")}>{t("CAMREW_5")}</span>
      </div>

      <h1 className="text-2xl font-bold text-[#172B4D]" {...hl("CAMREW_5")}>{t("CAMREW_5")}</h1>

      <div className="bg-[#F5F6F7] rounded p-4 text-sm text-[#172B4D] flex gap-2">
        <div className="w-1.5 h-1.5 bg-[#6B778C] rounded-full mt-1.5 flex-shrink-0" />
        <span {...hl("CAMREW_reward_points_understand")}>{t("CAMREW_reward_points_understand")}</span>
      </div>

      <div className="space-y-4">
        {toggles.map((toggle) => (
          <div key={toggle.id} className="flex items-center gap-4">
            <div className="w-10 h-5 rounded-full relative flex-shrink-0 cursor-pointer bg-[#0052CC]">
              <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 left-[22px]" />
            </div>
            <div className="text-sm font-medium text-[#172B4D]" {...hl(toggle.id)}>
              {t(toggle.id) !== `[${toggle.id}]` ? t(toggle.id) : toggle.defaultLabel}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-6 mt-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-[#172B4D] block" {...hl("CAMREW_16")}>{t("CAMREW_16")}</label>
          <div className="flex items-center gap-2">
            <div className="border border-[#DFE1E6] rounded px-3 py-2 text-sm bg-[#F5F6F7] text-[#172B4D]" {...hl("CAMREW_17")}>
              {t("CAMREW_17") !== "[CAMREW_17]" ? t("CAMREW_17") : "Assign"}
            </div>
            <input type="text" className="border border-[#DFE1E6] rounded px-3 py-2 w-16 text-sm text-center text-[#172B4D] focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC]" defaultValue="5" />
            <div className="border border-[#DFE1E6] rounded px-3 py-2 text-sm bg-[#F5F6F7] text-[#172B4D]" {...hl("CAMREW_20")}>
              {t("CAMREW_20") !== "[CAMREW_20]" ? t("CAMREW_20") : "Points for each"}
            </div>
            <div className="border border-[#DFE1E6] rounded px-3 py-2 text-sm bg-[#F5F6F7] text-[#172B4D]">₹</div>
            <input type="text" className="border border-[#DFE1E6] rounded px-3 py-2 w-16 text-sm text-center text-[#172B4D] focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC]" defaultValue="100" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[#172B4D] block" {...hl("CAMREW_24")}>{t("CAMREW_24")}</label>
          <div className="flex items-center gap-2">
            <input type="text" className="border border-[#DFE1E6] rounded px-3 py-2 w-16 text-sm text-center text-[#172B4D] focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC]" defaultValue="1" />
            <div className="border border-[#DFE1E6] rounded px-3 py-2 text-sm bg-[#F5F6F7] text-[#172B4D]">₹</div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[#172B4D] block" {...hl("CAMREW_27")}>{t("CAMREW_27")}</label>
          <input type="text" className="border border-[#DFE1E6] rounded px-3 py-2 w-24 text-sm text-[#172B4D] focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC]" defaultValue="150" />
        </div>
      </div>

      <div className="fixed bottom-6 right-6">
        <div className="w-14 h-14 bg-[#0052CC] rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:bg-[#0747A6] transition-colors">
          <MessageSquare className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}
