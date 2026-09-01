import { useState } from "react";
import { 
  Check, 
  CaretDown, 
  ArrowRight,
  WarningCircle
} from "@phosphor-icons/react";
import type { EnglishCopyStatus, TranslationStatus, DeploymentRecord } from "../../types";

export type StageId = "source" | "translate" | "deploy";
export type StepStatus = "completed" | "active" | "pending" | "attention";

export interface WorkflowStage {
  id: StageId;
  label: string;
  sublabel: string;
  status: StepStatus;
  targetId: string;
}

export interface NextActionInfo {
  title: string;
  description: string;
  targetId?: string;
  actionText?: string;
}

export interface WorkflowStepperProps {
  englishStatus?: EnglishCopyStatus;
  englishText?: string;
  englishVersion?: number;
  translationStatus?: TranslationStatus;
  selectedLanguage: string;
  languageName: string;
  deployments: DeploymentRecord[];
  onActionClick?: (targetId: string) => void;
}

export function getLifecycleState(
  englishStatus: EnglishCopyStatus | undefined,
  englishText: string,
  englishVersion: number,
  translationStatus: TranslationStatus,
  languageName: string,
  deployments: DeploymentRecord[]
): { stages: WorkflowStage[]; nextAction: NextActionInfo | null } {
  const hasEnglishText = Boolean(englishText && englishText.trim().length > 0);
  const effectiveEnglishStatus: EnglishCopyStatus = englishStatus || (hasEnglishText ? "Approved" : "Draft");
  const isEngApproved = effectiveEnglishStatus === "Approved" && hasEnglishText;
  const isEngPending = effectiveEnglishStatus === "Pending Review";
  const isEngDraft = effectiveEnglishStatus === "Draft";

  // Stage 1: Source (English Copy)
  let sourceStatus: StepStatus = "pending";
  let sourceSublabel = `v${englishVersion || 1}`;

  if (isEngApproved) {
    sourceStatus = "completed";
    sourceSublabel = `v${englishVersion || 1} · Approved`;
  } else if (isEngPending) {
    sourceStatus = "active";
    sourceSublabel = `v${englishVersion || 1} · In Review`;
  } else if (!hasEnglishText) {
    sourceStatus = "active";
    sourceSublabel = "No Copy";
  } else {
    sourceStatus = "active";
    sourceSublabel = `v${englishVersion || 1} · Draft`;
  }

  // Stage 2: Translate (Language Translation)
  let translateStatus: StepStatus = "pending";
  let translateSublabel = "Waiting";

  if (!isEngApproved) {
    translateStatus = "pending";
    translateSublabel = "Waiting on English";
  } else {
    if (translationStatus === "Approved") {
      translateStatus = "completed";
      translateSublabel = "Approved";
    } else if (translationStatus === "Stale") {
      translateStatus = "attention";
      translateSublabel = "Stale";
    } else if (translationStatus === "Pending Review") {
      translateStatus = "active";
      translateSublabel = "In Review";
    } else if (translationStatus === "Draft") {
      translateStatus = "active";
      translateSublabel = "Draft";
    } else {
      translateStatus = "active";
      translateSublabel = "Pending";
    }
  }

  // Stage 3: Deploy (Release status)
  let deployStatus: StepStatus = "pending";
  let deploySublabel = "Not Live";

  const successfulDeps = deployments.filter(d => d.status === "SUCCESSFUL");
  const hasProd = successfulDeps.some(d => d.environment === "PRODUCTION");
  const hasQa = successfulDeps.some(d => d.environment === "QA");
  const hasDev = successfulDeps.some(d => d.environment === "DEV");

  if (hasProd) {
    deployStatus = "completed";
    deploySublabel = "Live in Prod";
  } else if (hasQa || hasDev) {
    deployStatus = "active";
    deploySublabel = hasQa ? "Live in QA" : "Live in Dev";
  } else {
    if (translateStatus === "completed") {
      deployStatus = "active";
      deploySublabel = "Ready to Deploy";
    } else {
      deployStatus = "pending";
      deploySublabel = "Waiting";
    }
  }

  const stages: WorkflowStage[] = [
    {
      id: "source",
      label: "Source",
      sublabel: sourceSublabel,
      status: sourceStatus,
      targetId: "english-copy-panel"
    },
    {
      id: "translate",
      label: "Translate",
      sublabel: translateSublabel,
      status: translateStatus,
      targetId: "translation-panel"
    },
    {
      id: "deploy",
      label: "Deploy",
      sublabel: deploySublabel,
      status: deployStatus,
      targetId: "properties-panel"
    }
  ];

  let nextAction: NextActionInfo | null = null;

  if (!hasEnglishText) {
    nextAction = {
      title: "Write English Copy",
      description: "Author master copy to start translation.",
      targetId: "english-copy-panel",
      actionText: "Edit English"
    };
  } else if (isEngDraft) {
    nextAction = {
      title: "Submit English Draft",
      description: "Submit copy for approval.",
      targetId: "english-copy-panel",
      actionText: "Review Copy"
    };
  } else if (isEngPending) {
    nextAction = {
      title: "Approve English Copy",
      description: "Approve copy to unlock translation.",
      targetId: "english-copy-panel",
      actionText: "Approve"
    };
  } else if (translationStatus === "No Trans" || !translationStatus) {
    nextAction = {
      title: `Translate to ${languageName}`,
      description: `Run Auto-Translate or author ${languageName}.`,
      targetId: "translation-panel",
      actionText: "Translate"
    };
  } else if (translationStatus === "Draft") {
    nextAction = {
      title: `Submit ${languageName} Draft`,
      description: `Queue translation for review.`,
      targetId: "translation-panel",
      actionText: "Edit"
    };
  } else if (translationStatus === "Pending Review") {
    nextAction = {
      title: `Review ${languageName}`,
      description: `Review translation and variable integrity.`,
      targetId: "translation-panel",
      actionText: "Review"
    };
  } else if (translationStatus === "Stale") {
    nextAction = {
      title: `Update Stale Translation`,
      description: `English was updated to v${englishVersion}.`,
      targetId: "translation-panel",
      actionText: "Resolve"
    };
  } else if (translationStatus === "Approved") {
    if (!hasProd) {
      nextAction = {
        title: hasQa || hasDev ? "Promote to Production" : `Deploy ${languageName}`,
        description: `Ready for staging or production release.`,
        targetId: "properties-panel",
        actionText: "Deploy"
      };
    } else {
      nextAction = null;
    }
  }

  return { stages, nextAction };
}

export function WorkflowStepper({
  englishStatus,
  englishText = "",
  englishVersion = 1,
  translationStatus = "No Trans",
  languageName,
  deployments,
  onActionClick
}: WorkflowStepperProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("miotranslate_workflow_stepper_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem("miotranslate_workflow_stepper_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const { stages, nextAction } = getLifecycleState(
    englishStatus,
    englishText,
    englishVersion,
    translationStatus,
    languageName,
    deployments
  );

  const completedCount = stages.filter(s => s.status === "completed").length;

  const handleActionClick = (targetId?: string) => {
    if (!targetId) return;
    if (onActionClick) {
      onActionClick(targetId);
      return;
    }
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-1", "ring-accent-blue/40", "transition-all", "duration-300");
      setTimeout(() => {
        el.classList.remove("ring-1", "ring-accent-blue/40");
      }, 1500);
    }
  };

  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl p-3.5 shadow-xs">
      {/* Quiet Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-border-subtle mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-text-primary">
            Lifecycle
          </span>
          <span className="text-[10px] font-mono text-text-tertiary">
            ({completedCount}/3)
          </span>
        </div>

        <button
          onClick={toggleCollapse}
          className="text-text-tertiary hover:text-text-primary p-0.5 rounded transition-colors outline-none cursor-pointer"
          title={collapsed ? "Expand lifecycle" : "Collapse lifecycle"}
        >
          <CaretDown className={`w-3.5 h-3.5 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`} />
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-3">
          {/* Minimal Flow Diagram Track */}
          <div className="relative py-1">
            {/* Background 1px connecting line */}
            <div className="absolute top-2.5 left-[16%] right-[16%] h-px bg-border-subtle z-0" />
            
            {/* Active completed 1px segments */}
            <div 
              className={`absolute top-2.5 left-[16%] right-[50%] h-px transition-all duration-300 z-0 ${
                stages[0].status === "completed" ? "bg-emerald-500/60" : "bg-transparent"
              }`}
            />
            <div 
              className={`absolute top-2.5 left-[50%] right-[16%] h-px transition-all duration-300 z-0 ${
                stages[1].status === "completed" ? "bg-emerald-500/60" : "bg-transparent"
              }`}
            />

            {/* 3 Minimalist Nodes */}
            <div className="relative z-10 flex items-start justify-between">
              {stages.map((stage) => {
                const isCompleted = stage.status === "completed";
                const isActive = stage.status === "active";
                const isAttention = stage.status === "attention";

                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => handleActionClick(stage.targetId)}
                    className="flex flex-col items-center text-center cursor-pointer outline-none group flex-1"
                  >
                    {/* Delicate 20px micro-node */}
                    <div 
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-all bg-bg-card ${
                        isCompleted
                          ? "border border-emerald-500/50 text-emerald-500 bg-emerald-500/10 shadow-2xs"
                          : isAttention
                          ? "border border-amber-500/50 text-amber-500 bg-amber-500/10"
                          : isActive
                          ? "border border-accent-blue text-accent-blue bg-accent-blue/10 shadow-2xs"
                          : "border border-border-strong text-text-tertiary"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-2.5 h-2.5" weight="bold" />
                      ) : isAttention ? (
                        <WarningCircle className="w-3 h-3" weight="bold" />
                      ) : isActive ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
                      ) : (
                        <div className="w-1 h-1 rounded-full bg-border-strong" />
                      )}
                    </div>

                    {/* Label */}
                    <span className={`text-[11px] font-medium mt-1.5 transition-colors ${
                      isCompleted 
                        ? "text-text-primary" 
                        : isActive 
                        ? "text-text-primary font-semibold" 
                        : isAttention
                        ? "text-amber-500"
                        : "text-text-secondary"
                    }`}>
                      {stage.label}
                    </span>

                    {/* Subtext */}
                    <span className="text-[9.5px] text-text-tertiary font-mono mt-0.5 leading-tight whitespace-nowrap">
                      {stage.sublabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minimal 1-line Next Action footer */}
          {nextAction ? (
            <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] gap-2">
              <span className="text-text-secondary truncate">
                <span className="text-text-tertiary font-mono mr-1">Next:</span>
                {nextAction.title}
              </span>

              {nextAction.targetId && (
                <button
                  type="button"
                  onClick={() => handleActionClick(nextAction.targetId)}
                  className="text-link hover:underline font-medium text-[11px] shrink-0 inline-flex items-center gap-0.5 cursor-pointer outline-none"
                >
                  <span>{nextAction.actionText || "Go"}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : (
            <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
              <span className="flex items-center gap-1.5">
                <Check className="w-3 h-3" weight="bold" />
                <span>Complete · Live</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
