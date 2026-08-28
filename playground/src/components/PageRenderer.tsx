import type { RenderResult, ChangeResult } from "../api";
import { SersetFixture } from "../fixtures/SERSET";
import { PotsalesetFixture } from "../fixtures/POTSALESET";
import { StaffsetFixture } from "../fixtures/STAFFSET";
import { CamrewFixture } from "../fixtures/CAMREW";
import { CuswishFixture } from "../fixtures/CUSWISH";
import { GenericTagList } from "../fixtures/GenericTagList";

interface PageRendererProps {
  renderData: RenderResult;
  changeData: ChangeResult | null;
  showChanges: boolean;
}

export function PageRenderer({ renderData, changeData, showChanges }: PageRendererProps) {
  
  // Translation resolver function passed to fixtures
  const t = (tagName: string) => {
    const tag = renderData.resolvedTags.find(t => t.tagName === tagName);
    let val = tag ? tag.value : `[${tagName}]`;
    
    // Fallback indicator
    if (tag && tag.fallbackUsed) {
      val = `[${tag.fallbackLang.toUpperCase()}] ${val}`;
    }
    return val;
  };

  const getHighlightProps = (tagName: string) => {
    if (!showChanges || !changeData) return {};
    const change = changeData.changes.find(c => c.tagName === tagName);
    if (change) {
      return {
        className: "highlight-changed",
        "data-before": change.before || "(empty)"
      };
    }
    return {};
  };

  const renderContent = () => {
    switch (renderData.pageId) {
      case "SERSET":
        return <SersetFixture t={t} hl={getHighlightProps} />;
      case "POTSALESET":
        return <PotsalesetFixture t={t} hl={getHighlightProps} />;
      case "STAFFSET":
        return <StaffsetFixture t={t} hl={getHighlightProps} />;
      case "CAMREW":
        return <CamrewFixture t={t} hl={getHighlightProps} />;
      case "CUSWISH":
        return <CuswishFixture t={t} hl={getHighlightProps} />;
      default:
        return <GenericTagList tags={renderData.resolvedTags} />;
    }
  };

  const isRtl = renderData.language === "arabic";

  return (
    <div 
      dir={isRtl ? "rtl" : "ltr"}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[600px] transition-all"
    >
      {renderContent()}
    </div>
  );
}
