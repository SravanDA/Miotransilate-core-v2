import { Button } from "../components/Button";
import { ChevronDown, Search } from "lucide-react";

interface FixtureProps {
  t: (tagName: string) => string;
  hl: (tagName: string) => any;
}

export function CuswishFixture({ t, hl }: FixtureProps) {
  const tableData = [
    { name: "Anita Smith", mobile: "9876543210", email: "anita@example.com", gender: "CUSWISH_FEMALE", date: "15 Oct 2026" },
    { name: "John Doe", mobile: "9876543211", email: "john@example.com", gender: "CUSWISH_MALE", date: "18 Oct 2026" },
    { name: "Sarah Lee", mobile: "9876543212", email: "sarah@example.com", gender: "CUSWISH_FEMALE", date: "21 Oct 2026" },
  ];

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="flex items-center gap-2 text-sm text-[#6B778C]">
        <span className="cursor-pointer hover:underline">Customers</span>
        <span>/</span>
        <span>Customer Wishes</span>
      </div>

      <h1 className="text-2xl font-bold text-[#172B4D]">Customer Wishes</h1>

      <div className="border border-[#DFE1E6] rounded p-5 bg-white shadow-sm flex flex-wrap gap-4 items-end">
        {/* Type Selection */}
        <div className="flex flex-col gap-1 w-64">
          <label className="text-sm font-medium text-[#172B4D]" {...hl("CUSWISH_10")}>{t("CUSWISH_10")}</label>
          <div className="relative">
            <select className="w-full border border-[#DFE1E6] rounded px-3 py-2 text-sm text-[#172B4D] appearance-none bg-white focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] cursor-pointer">
              <option value="" disabled selected {...hl("CUSWISH_27")}>{t("CUSWISH_27")}</option>
              <option value="birthday" {...hl("CUSWISH_28")}>{t("CUSWISH_28")}</option>
              <option value="anniversary" {...hl("CUSWISH_29")}>{t("CUSWISH_29")}</option>
            </select>
            <ChevronDown className="w-4 h-4 text-[#6B778C] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Duration Selection */}
        <div className="flex flex-col gap-1 w-64">
          <label className="text-sm font-medium text-[#172B4D]" {...hl("CUSWISH_4")}>{t("CUSWISH_4")}</label>
          <div className="relative">
            <select className="w-full border border-[#DFE1E6] rounded px-3 py-2 text-sm text-[#172B4D] appearance-none bg-white focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] cursor-pointer">
              <option value="" disabled selected {...hl("CUSWISH_22")}>{t("CUSWISH_22")}</option>
              <option value="7" {...hl("CUSWISH_23")}>{t("CUSWISH_23")}</option>
              <option value="15" {...hl("CUSWISH_24")}>{t("CUSWISH_24")}</option>
              <option value="30" {...hl("CUSWISH_25")}>{t("CUSWISH_25")}</option>
              <option value="custom" {...hl("CUSWISH_26")}>{t("CUSWISH_26")}</option>
            </select>
            <ChevronDown className="w-4 h-4 text-[#6B778C] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Custom Range (disabled state for mockup) */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-1 w-40">
            <label className="text-sm font-medium text-[#172B4D]" {...hl("CUSWISH_6")}>{t("CUSWISH_6")}</label>
            <input type="date" className="border border-[#DFE1E6] rounded px-3 py-2 text-sm text-[#6B778C] bg-[#F5F6F7] cursor-not-allowed" disabled />
          </div>
          <span className="text-sm text-[#6B778C] mt-5" {...hl("CUSWISH_8")}>{t("CUSWISH_8")}</span>
          <div className="flex flex-col gap-1 w-40">
            <label className="text-sm font-medium text-transparent">.</label>
            <input type="date" className="border border-[#DFE1E6] rounded px-3 py-2 text-sm text-[#6B778C] bg-[#F5F6F7] cursor-not-allowed" disabled />
          </div>
        </div>

        {/* Search Button */}
        <Button variant="primary" className="flex items-center gap-2 h-[38px]">
          <Search className="w-4 h-4" />
          <span {...hl("CUSWISH_12")}>{t("CUSWISH_12")}</span>
        </Button>
      </div>

      <div className="border border-[#DFE1E6] rounded bg-white overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F5F6F7] border-b border-[#DFE1E6]">
            <tr>
              <th className="px-4 py-3 font-semibold text-[#172B4D]" {...hl("CUSWISH_13")}>{t("CUSWISH_13")}</th>
              <th className="px-4 py-3 font-semibold text-[#172B4D]" {...hl("CUSWISH_14")}>{t("CUSWISH_14")}</th>
              <th className="px-4 py-3 font-semibold text-[#172B4D]" {...hl("CUSWISH_15")}>{t("CUSWISH_15")}</th>
              <th className="px-4 py-3 font-semibold text-[#172B4D]" {...hl("CUSWISH_16")}>{t("CUSWISH_16")}</th>
              <th className="px-4 py-3 font-semibold text-[#172B4D]" {...hl("CUSWISH_17")}>{t("CUSWISH_17")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DFE1E6]">
            {tableData.map((row, i) => (
              <tr key={i} className="hover:bg-[#F5F6F7]">
                <td className="px-4 py-3 text-[#172B4D] font-medium">{row.name}</td>
                <td className="px-4 py-3 text-[#6B778C]">{row.mobile}</td>
                <td className="px-4 py-3 text-[#6B778C]">{row.email}</td>
                <td className="px-4 py-3 text-[#6B778C]" {...hl(row.gender)}>{t(row.gender)}</td>
                <td className="px-4 py-3 text-[#172B4D] font-medium">{row.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Pagination placeholder */}
        <div className="bg-[#F5F6F7] border-t border-[#DFE1E6] px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-[#6B778C]">Showing 1 to 3 of 3 entries</div>
          <div className="flex gap-2">
            <Button variant="outline" className="px-3 py-1 text-sm bg-white" disabled {...hl("CUSWISH_20")}>{t("CUSWISH_20")}</Button>
            <Button variant="outline" className="px-3 py-1 text-sm bg-white" disabled {...hl("CUSWISH_21")}>{t("CUSWISH_21")}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
