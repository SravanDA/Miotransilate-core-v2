import { Info, Search, Trash2, ChevronDown } from "lucide-react";
import { Button } from "../components/Button";

interface FixtureProps {
  t: (tagName: string) => string;
  hl: (tagName: string) => any;
}

export function SersetFixture({ t, hl }: FixtureProps) {
  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="cursor-pointer hover:underline" {...hl("SERSET_1")}>{t("SERSET_1")}</span>
        <span>/</span>
        <span className="text-gray-500" {...hl("SERSET_2")}>{t("SERSET_2")}</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900" {...hl("SERSET_2")}>{t("SERSET_2")}</h1>

      <div className="bg-blue-50 rounded p-5 text-sm text-[#172B4D]">
        <div className="flex items-center gap-2 font-semibold text-[#0052CC] mb-3">
          <Info className="w-5 h-5 text-[#0052CC]" />
          <span>Info</span>
        </div>
        <ul className="list-disc pl-5 space-y-3 mb-4">
          <li {...hl("SERSET_3")}>{t("SERSET_3")}</li>
          <li {...hl("SERSET_52")}>{t("SERSET_52")}</li>
          <li>Click Save Order to apply changes across Quick Sale, Appointment, and Online Booking.</li>
        </ul>
        <p className="mb-1">Tip: You can add both single-staff and multi-staff services under any group.</p>
        <p>Reminder: Changes you make here will instantly reflect in your booking flow and reports.</p>
      </div>

      <div className="border border-[#DFE1E6] rounded p-5 bg-white shadow-sm">
        <div className="flex items-end justify-between mb-6">
          <div className="flex flex-col gap-1 w-[400px]">
            <label className="text-sm font-medium text-[#172B4D]">Search Services</label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#6B778C] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                className="w-full border border-[#DFE1E6] rounded px-3 py-2 pl-9 text-sm text-[#172B4D] focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC]"
                placeholder={t("SERSET_5")}
                readOnly
                {...hl("SERSET_5")}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 border border-[#DE350B]/30 rounded text-[#DE350B] hover:bg-[#DE350B]/10 transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
            <Button variant="primary" {...hl("SERSET_11")}>
              {t("SERSET_11")}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { name: "Hair Services", count: 4 },
            { name: "Beauty Services", count: 6 },
            { name: "Hair Removal", count: 2 },
            { name: "Spa Services", count: 3 },
          ].map((group, idx) => (
            <div key={idx} className="flex items-center justify-between border border-[#DFE1E6] rounded p-3 bg-[#F5F6F7]">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full border border-[#DFE1E6] bg-white flex items-center justify-center">
                  <ChevronDown className="w-4 h-4 text-[#6B778C]" />
                </div>
                <span className="text-[#172B4D] font-medium">{group.name} ({group.count})</span>
              </div>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-1 border border-[#0052CC]/30 text-[#0052CC] bg-white px-4 py-1.5 rounded hover:bg-blue-50 text-sm font-medium transition-colors">
                  Actions <ChevronDown className="w-4 h-4" />
                </button>
                <Button variant="primary" className="py-1.5" {...hl("SERSET_22")}>
                  {t("SERSET_22")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
