import { Search, ChevronDown, Unlock, MessageSquare } from "lucide-react";
import { Button } from "../components/Button";

interface FixtureProps {
  t: (tagName: string) => string;
  hl: (tagName: string) => any;
}

export function StaffsetFixture({ t, hl }: FixtureProps) {
  const tableData = [
    { name: "Revathy", mobile: "7736536297", email: "sravanpm@waffor.com", appointment: "Enabled", login: "Enabled", status: true, locked: false, role: "2 Individual Permissions" },
    { name: "Carol", mobile: "8973659385", email: "sravan.suresh.2k01@gmail.com", appointment: "Enabled", login: "Enabled", status: true, locked: false, role: "-" },
    { name: "Abhijay", mobile: "773653879", email: "demo4332@gmail.com", appointment: "Enabled", login: "Enabled", status: true, locked: false, role: "1 Individual Permissions" },
    { name: "Rita", mobile: "-", email: "-", appointment: "Enabled", login: "Disabled", status: true, locked: false, role: "-" },
    { name: "John", mobile: "-", email: "-", appointment: "Enabled", login: "Disabled", status: true, locked: false, role: "-" },
    { name: "Merlin", mobile: "-", email: "-", appointment: "Enabled", login: "Disabled", status: true, locked: false, role: "-" },
    { name: "Michael", mobile: "-", email: "-", appointment: "Enabled", login: "Disabled", status: true, locked: false, role: "-" },
    { name: "Suvitha", mobile: "7736536297", email: "sravan.suresh.2k01@gmail.com", appointment: "Enabled", login: "Disabled", status: true, locked: false, role: "-" },
  ];

  const tabs = [
    "Staff List", "User List", "Daily Working Hours", "Business Closed Dates", 
    "Commission Profile", "Staff Commission", "Assign Product", "Product Stock"
  ];

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="flex items-center gap-2 text-sm text-[#6B778C]">
        <span className="cursor-pointer hover:underline">Settings</span>
        <span>/</span>
        <span>Staff</span>
      </div>

      <div className="flex gap-6 border-b border-[#DFE1E6]">
        {tabs.map((tab, i) => (
          <div 
            key={i} 
            className={`pb-3 text-sm font-semibold cursor-pointer whitespace-nowrap ${i === 0 ? 'text-[#0052CC] border-b-2 border-[#0052CC]' : 'text-[#6B778C] hover:text-[#172B4D]'}`}
          >
            {tab}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="relative w-96">
          <input
            type="text"
            className="w-full border border-[#DFE1E6] rounded px-3 py-2 pr-9 text-sm text-[#172B4D] focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC]"
            placeholder="Search mobile number/email id/staff name"
            readOnly
          />
          <Search className="w-4 h-4 text-[#6B778C] absolute right-3 top-1/2 -translate-y-1/2" />
        </div>
        <Button variant="primary">Add New Staff</Button>
      </div>

      <div className="border border-[#DFE1E6] rounded bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F5F6F7] border-b border-[#DFE1E6]">
            <tr>
              {["Staff Name", "Mobile", "Email", "Appointment", "Login Access", "Status", "Access Control", "Roles & Permissions"].map((h, i) => (
                <th key={i} className="px-4 py-3 font-semibold text-[#172B4D]">
                  <div className="flex items-center gap-1">
                    <span {...(h === "Mobile" ? hl("STAFFSET_11") : h === "Email" ? hl("STAFFSET_13") : {})}>
                      {h === "Mobile" ? (t("STAFFSET_11") !== "[STAFFSET_11]" ? t("STAFFSET_11") : "Mobile") : 
                       h === "Email" ? (t("STAFFSET_13") !== "[STAFFSET_13]" ? t("STAFFSET_13") : "Email") : h}
                    </span>
                    <ChevronDown className="w-3 h-3 text-[#6B778C]" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DFE1E6]">
            {tableData.map((row, i) => (
              <tr key={i} className="hover:bg-[#F5F6F7]">
                <td className="px-4 py-4 text-[#172B4D]">{row.name}</td>
                <td className="px-4 py-4 text-[#6B778C]">{row.mobile}</td>
                <td className="px-4 py-4 text-[#6B778C]">{row.email}</td>
                <td className="px-4 py-4 text-[#6B778C]">{row.appointment}</td>
                <td className="px-4 py-4 text-[#6B778C]">{row.login}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#0052CC] rounded-sm flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-[#172B4D]">Active</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <Unlock className="w-4 h-4 text-[#0052CC]" />
                </td>
                <td className="px-4 py-4 text-[#6B778C] whitespace-nowrap">{row.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="fixed bottom-6 right-6">
        <div className="w-14 h-14 bg-[#0052CC] rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:bg-[#0747A6] transition-colors">
          <MessageSquare className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}
