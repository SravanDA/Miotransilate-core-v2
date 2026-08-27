interface FixtureProps {
  t: (tagName: string) => string;
  hl: (tagName: string) => any;
}

export function CusinsFixture({ t, hl }: FixtureProps) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-text-main" {...hl("CUSINS_13")}>{t("CUSINS_13")}</h2>

      <div className="flex gap-2 flex-wrap">
        {["CUSINS_38","CUSINS_39","CUSINS_33","CUSINS_34","CUSINS_35","CUSINS_40","CUSINS_41","CUSINS_42","CUSINS_43","CUSINS_32"].map(tag => (
          <button key={tag} className="border border-border-main rounded px-3 py-1.5 text-xs text-text-main hover:bg-slate-50" {...hl(tag)}>
            {t(tag)}
          </button>
        ))}
        <button className="border border-primary text-primary rounded px-3 py-1.5 text-xs font-medium" {...hl("CUSINS_CUSTOM_RANGE")}>
          {t("CUSINS_CUSTOM_RANGE")}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface border border-border-main rounded-xl p-4">
          <div className="text-xs text-text-subtle" {...hl("CUSINS_Total_Customer")}>{t("CUSINS_Total_Customer")}</div>
          <div className="text-2xl font-bold text-text-main mt-1">—</div>
        </div>
        <div className="bg-surface border border-border-main rounded-xl p-4">
          <div className="text-xs text-text-subtle" {...hl("CUSINS_46")}>{t("CUSINS_46")}</div>
          <div className="text-2xl font-bold text-text-main mt-1">—</div>
        </div>
        <div className="bg-surface border border-border-main rounded-xl p-4">
          <div className="text-xs text-text-subtle" {...hl("CUSINS_47")}>{t("CUSINS_47")}</div>
          <div className="text-2xl font-bold text-text-main mt-1">—</div>
        </div>
      </div>

      <div className="bg-surface border border-border-main rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-main mb-3" {...hl("CUSINS_4")}>{t("CUSINS_4")}</h3>
        <div className="flex gap-4 text-sm text-text-main">
          <span className="flex items-center gap-1" {...hl("MALE")}>● {t("MALE")}</span>
          <span className="flex items-center gap-1" {...hl("FEMALE")}>● {t("FEMALE")}</span>
          <span className="flex items-center gap-1" {...hl("OTHERS")}>● {t("OTHERS")}</span>
        </div>
        <div className="mt-4 text-sm text-text-subtle italic" {...hl("CUSINS_8")}>{t("CUSINS_8")}</div>
        <div className="text-xs text-text-subtle mt-1" {...hl("CUSINS_9")}>{t("CUSINS_9")}</div>
      </div>

      <div className="bg-surface border border-border-main rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-text-main" {...hl("CUSINS_15")}>{t("CUSINS_15")}</h3>
        <div className="flex gap-3 text-xs">
          <span className="bg-green-50 border border-green-200 rounded-full px-3 py-1" {...hl("CUSINS_Retained")}>{t("CUSINS_Retained")}</span>
          <span className="bg-red-50 border border-red-200 rounded-full px-3 py-1" {...hl("CUSINS_Defected")}>{t("CUSINS_Defected")}</span>
          <span className="bg-yellow-50 border border-yellow-200 rounded-full px-3 py-1" {...hl("CUSINS_Churn_Prediction")}>{t("CUSINS_Churn_Prediction")}</span>
        </div>
      </div>

      <div className="bg-surface border border-border-main rounded-xl p-5 space-y-2">
        <h3 className="text-sm font-semibold text-text-main" {...hl("CUSINS_16")}>{t("CUSINS_16")}</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="text-text-main" {...hl("CUSINS_New_Customer")}>{t("CUSINS_New_Customer")}</div>
          <div className="text-text-main" {...hl("CUSINS_Active_Customer")}>{t("CUSINS_Active_Customer")}</div>
          <div className="text-text-main" {...hl("CUSINS_Retained_Customer")}>{t("CUSINS_Retained_Customer")}</div>
          <div className="text-text-main" {...hl("CUSINS_Defected_Customer")}>{t("CUSINS_Defected_Customer")}</div>
        </div>
      </div>
    </div>
  );
}
