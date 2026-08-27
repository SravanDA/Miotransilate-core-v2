// @ts-nocheck
import { useState } from "react";
import {
  BookOpen,
  Settings,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Users,
  Eye,
  FileText,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  Globe,
  Tag,
  CheckCircle2,
  XCircle,
  ChevronRight,
  BarChart3,
  MessageSquare,
  Lightbulb,
  Search,
  Download,
  Upload,
  Lock,
  Zap,
  Target,
  ListChecks,
  HelpCircle,
  Ban
} from "lucide-react";

/* ─── Sidebar TOC ─── */
const toc = [
  { id: "purpose", label: "Purpose" },
  { id: "what-it-achieves", label: "What It Achieves" },
  { id: "why-introduced", label: "Why It Was Introduced" },
  { id: "how-it-works", label: "How the System Works" },
  { id: "glossary", label: "Key Terminology" },
  { id: "rbac", label: "Roles & Permissions" },
  { id: "workflow", label: "End-to-End Workflow" },
  { id: "features", label: "Feature Guide" },
  { id: "best-practices", label: "Best Practices" },
  { id: "what-not-to-do", label: "What NOT To Do" },
  { id: "faq", label: "FAQ" },
];

export function Guide() {
  const [activeSection, setActiveSection] = useState("purpose");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex gap-10 max-w-7xl w-full mx-auto pb-20">
      {/* ─── Left sidebar ─── */}
      <aside className="hidden lg:flex flex-col w-52 shrink-0 sticky top-28 self-start">
        <div className="flex items-center gap-2 mb-5">
          <BookOpen className="w-4 h-4 text-[#42526E] stroke-[1.5]" />
          <span className="text-[11px] font-bold text-[#6B778C] uppercase tracking-wider">Contents</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {toc.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className={`text-left px-3 py-2 rounded text-[13px] transition-colors cursor-pointer ${
                activeSection === item.id
                  ? "bg-[#DEEBFF] text-[#0747A6] font-bold"
                  : "text-[#42526E] hover:text-[#172B4D] hover:bg-[#F4F5F7] font-medium"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ─── Main content ─── */}
      <div className="flex-1 flex flex-col gap-0 min-w-0">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-[24px] font-bold text-[#172B4D] mb-1">MioTranslate - Team Guide</h1>
          <p className="text-[14px] text-[#5E6C84] leading-relaxed">
            Everything you need to know to use MioTranslate - from first login to publishing translations in production.
            Written for every team member: product, engineering, support, sales, and the localization reviewers.
          </p>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            1. PURPOSE
        ════════════════════════════════════════════════════════════════ */}
        <Section id="purpose" title="What Is MioTranslate?">
          <P>
            MioTranslate is MioSalon's internal localization management platform. It is the single system
            where every translatable string in MioSalon's user interface is registered, translated,
            reviewed, and deployed.
          </P>
          <P>
            Think of it as a database of every button label, error message, page title, tooltip, and
            description across MioSalon - stored in English as the master copy, and then translated into
            every language our customers use (Tamil, Hindi, Arabic, Spanish, etc.).
          </P>
          <Callout type="info">
            <strong>In simple terms:</strong> MioTranslate makes sure that when a salon owner in Chennai opens MioSalon,
            they see the interface in Tamil - and when a salon owner in Dubai opens the same screen, they
            see it in Arabic. Every word, every button, every message.
          </Callout>
        </Section>

        {/* ════════════════════════════════════════════════════════════════
            2. WHAT IT ACHIEVES
        ════════════════════════════════════════════════════════════════ */}
        <Section id="what-it-achieves" title="What MioTranslate Achieves">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GuideItem
              icon={Globe}
              title="Multi-language Support"
              description="Centrally manage translations for every language MioSalon supports. Add a new language in Settings and every page instantly shows 0% coverage - giving the team a clear target."
            />
            <GuideItem
              icon={Zap}
              title="AI-Powered Translation"
              description="Automatically generates first-draft translations using AI. Each translation comes with a confidence score so reviewers know where to focus their effort."
            />
            <GuideItem
              icon={Eye}
              title="Quality Control"
              description="Built-in review and approval workflow ensures no translation reaches customers without being verified by a native-speaking reviewer."
            />
            <GuideItem
              icon={Rocket}
              title="Safe Deployments"
              description="Versioned bundles are promoted through three environments (Dev → QA → Production) so bad translations never reach live users without testing."
            />
            <GuideItem
              icon={BarChart3}
              title="Coverage Visibility"
              description="A real-time dashboard shows exactly how much of each page has been translated and approved for every language - making gaps immediately visible."
            />
            <GuideItem
              icon={ShieldCheck}
              title="Role-Based Access"
              description="Each team member sees and does only what their role permits. A Language Reviewer cannot deploy to Production. A Developer cannot edit English copy."
            />
          </div>
        </Section>

        {/* ════════════════════════════════════════════════════════════════
            3. WHY IT WAS INTRODUCED
        ════════════════════════════════════════════════════════════════ */}
        <Section id="why-introduced" title="Why MioTranslate Was Introduced">
          <P>
            Before MioTranslate, the localization process was manual and error-prone:
          </P>
          <BulletList items={[
            "Translations lived in scattered spreadsheets and JSON files with no single source of truth.",
            "When English copy changed, nobody tracked which translations became outdated - causing customers to see stale or incorrect text.",
            "There was no formal review step. Developers would paste translations directly into code without native-speaker verification.",
            "Deploying a translation fix required a full product release, even for a single typo.",
            "There was no visibility into which screens were fully translated and which had gaps.",
          ]} />
          <P>
            MioTranslate solves all of these problems by providing a structured, auditable, role-based workflow
            with version control and environment-based deployment.
          </P>
        </Section>

        {/* ════════════════════════════════════════════════════════════════
            4. HOW THE SYSTEM WORKS
        ════════════════════════════════════════════════════════════════ */}
        <Section id="how-it-works" title="How the System Works">
          <P>
            MioTranslate organises all translatable content into a simple hierarchy:
          </P>

          <SubSection title="Structure: Pages → Tags → Translations">
            <div className="bg-[#F4F5F7] rounded-lg p-5 border border-[#DFE1E6] text-[13px] text-[#172B4D] leading-relaxed">
              <div className="font-bold mb-2">Example:</div>
              <div className="ml-0">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-[#42526E] shrink-0" />
                  <span><strong>Page:</strong> Quick Sale (POS screen)</span>
                </div>
                <div className="ml-6 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-[#6B778C] shrink-0" />
                    <span><strong>Tag:</strong> POS_BTN_CHECKOUT → "Checkout"</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-[#6B778C] shrink-0" />
                    <span><strong>Tag:</strong> POS_LBL_TAX → "Tax Amount"</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-[#6B778C] shrink-0" />
                    <span><strong>Tag:</strong> POS_MSG_SUCCESS → "Payment received successfully"</span>
                  </div>
                </div>
                <div className="mt-3 ml-12 flex flex-col gap-1 text-[#5E6C84]">
                  <span>Tamil: "கட்டணம் வெற்றிகரமாக பெறப்பட்டது"</span>
                  <span>Hindi: "भुगतान सफलतापूर्वक प्राप्त हुआ"</span>
                  <span>Arabic: "تم استلام الدفع بنجاح"</span>
                </div>
              </div>
            </div>
          </SubSection>

          <SubSection title="Translation Lifecycle">
            <P>
              Every translation goes through these states. Understanding this lifecycle is essential for every team member:
            </P>
            <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold mt-2 mb-3">
              <StatusPill color="#F4F5F7" text="#42526E" border="#DFE1E6">No Translation</StatusPill>
              <ArrowRight className="w-3.5 h-3.5 text-[#A5ADBA]" />
              <StatusPill color="#EAE6FF" text="#403294" border="#C0B6F2">Draft</StatusPill>
              <ArrowRight className="w-3.5 h-3.5 text-[#A5ADBA]" />
              <StatusPill color="#DEEBFF" text="#0747A6" border="#B3D4FF">Pending Review</StatusPill>
              <ArrowRight className="w-3.5 h-3.5 text-[#A5ADBA]" />
              <StatusPill color="#E3FCEF" text="#006644" border="#ABF5D1">Approved</StatusPill>
            </div>
            <P>
              If the master English copy changes after a translation is approved:
            </P>
            <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold mt-2 mb-3">
              <StatusPill color="#E3FCEF" text="#006644" border="#ABF5D1">Approved</StatusPill>
              <ArrowRight className="w-3.5 h-3.5 text-[#A5ADBA]" />
              <StatusPill color="#FFF0B3" text="#172B4D" border="#FFE380">⚠ Stale</StatusPill>
              <ArrowRight className="w-3.5 h-3.5 text-[#A5ADBA]" />
              <span className="text-[#5E6C84] font-medium">Re-review or re-translate</span>
            </div>
          </SubSection>

          <SubSection title="Deployment Pipeline">
            <P>
              Approved translations are packaged into versioned bundles (e.g., v1, v2, v3) and promoted through three environments:
            </P>
            <div className="flex items-center gap-4 text-[13px] font-bold mt-3 mb-3">
              <span className="px-4 py-2 rounded bg-[#DEEBFF] text-[#0747A6] border border-[#B3D4FF]">Dev</span>
              <ArrowRight className="w-4 h-4 text-[#A5ADBA]" />
              <span className="px-4 py-2 rounded bg-[#FFF0B3] text-[#172B4D] border border-[#FFE380]">QA</span>
              <ArrowRight className="w-4 h-4 text-[#A5ADBA]" />
              <span className="px-4 py-2 rounded bg-[#E3FCEF] text-[#006644] border border-[#ABF5D1]">Production</span>
            </div>
            <BulletList items={[
              "Dev - For developer testing. Verifies that translations render correctly in the UI.",
              "QA - For the QA team to test translations in context with real user flows.",
              "Production - Live for customers. Only promoted here after QA sign-off.",
            ]} />
          </SubSection>
        </Section>

        {/* ════════════════════════════════════════════════════════════════
            5. GLOSSARY
        ════════════════════════════════════════════════════════════════ */}
        <Section id="glossary" title="Key Terminology">
          <P>
            These are the terms used throughout MioTranslate. Bookmark this section for quick reference.
          </P>
          <div className="flex flex-col gap-0 mt-2">
            <GlossaryRow term="Page" definition="A registered MioSalon screen or module (e.g., Quick Sale, Calendar, Invoice). Each page contains all the tags that represent translatable strings on that screen." />
            <GlossaryRow term="Tag" definition="A unique identifier for a single translatable string (e.g., POS_BTN_CHECKOUT). Each tag holds the master English copy and translations for every active language." />
            <GlossaryRow term="Master English Copy" definition="The authoritative English string that is the source of truth. All translations are derived from this. When it changes, existing translations become stale." />
            <GlossaryRow term="Stale" definition="A translation is stale when its English source was updated but the translation hasn't been re-verified. Stale translations must be reviewed before they can be published." />
            <GlossaryRow term="Draft" definition="A translation that has been entered (manually or by AI) but not yet submitted for review. Drafts are work-in-progress and are never published." />
            <GlossaryRow term="Pending Review" definition="A translation submitted for approval. It appears in the Language Reviewer's queue and waits until it is approved or sent back for correction." />
            <GlossaryRow term="Approved" definition="A reviewed and confirmed translation. Only approved translations are included when publishing a bundle." />
            <GlossaryRow term="Confidence Score" definition="A percentage (0–100%) from the AI engine indicating how certain it is about a translation. Above 85% = likely correct. Below 70% = likely needs human editing." />
            <GlossaryRow term="Bundle" definition="A versioned, immutable snapshot of all approved translations for a page + language. Once published, a bundle cannot be edited - you fix the source and publish a new one." />
            <GlossaryRow term="Publish" definition="The act of packaging approved translations into a new versioned bundle and deploying it to the Dev environment." />
            <GlossaryRow term="Promote" definition="Moving a published bundle from one environment to the next (Dev → QA, or QA → Production). The bundle itself doesn't change - it just goes live in a higher environment." />
            <GlossaryRow term="Coverage" definition="The percentage of tags on a page that have approved translations for a given language. 100% = fully translated. 0% = nothing translated." />
            <GlossaryRow term="Back-translation" definition="An AI-generated reverse translation (target language → English) used as a quality check. If the back-translation doesn't match the original, the forward translation may be wrong." />
            <GlossaryRow term="Environment" definition="One of three deployment stages: Dev (testing), QA (quality assurance), Production (live for customers)." />
          </div>
        </Section>

        {/* ════════════════════════════════════════════════════════════════
            6. RBAC
        ════════════════════════════════════════════════════════════════ */}
        <Section id="rbac" title="Roles & Permissions (RBAC)">
          <P>
            MioTranslate uses role-based access control to ensure each team member can only perform
            actions appropriate to their role. You can switch between roles using the persona selector
            in the top-right corner of the header bar.
          </P>

          <RoleCard
            code="PM"
            name="Product Manager"
            whoIsThis="The person responsible for the English copy and the product's content strategy."
            canDo={[
              "Register new pages and create tags",
              "Write and edit master English copy",
              "Trigger AI translation for all tags on a page",
              "Publish bundles to Dev and QA environments",
              "View the Coverage Dashboard and Deployment status",
              "Export tags as CSV for external agencies",
            ]}
            cannotDo={[
              "Approve or reject translations (that's for reviewers)",
              "Promote bundles to Production",
              "Modify language configuration or system settings",
            ]}
          />

          <RoleCard
            code="LR"
            name="Language Reviewer"
            whoIsThis="A native speaker of the target language who ensures translation quality."
            canDo={[
              "View the review queue in My Work",
              "Approve, edit, or reject translations",
              "Resolve stale translation alerts",
              "Add comments and discussion on specific tags",
              "View back-translation quality checks",
            ]}
            cannotDo={[
              "Edit master English copy",
              "Register pages or create tags",
              "Publish or promote bundles to any environment",
            ]}
          />

          <RoleCard
            code="SR"
            name="Senior Reviewer"
            whoIsThis="The final authority on translation quality and production readiness."
            canDo={[
              "All Language Reviewer permissions",
              "Edit master English copy",
              "Publish bundles to Dev and QA",
              "Promote bundles to Production",
              "Override AI confidence thresholds for specific tags",
              "Final approval authority for critical customer-facing strings",
            ]}
            cannotDo={[
              "Modify system-level settings or language configuration",
            ]}
          />

          <RoleCard
            code="DEV"
            name="Developer"
            whoIsThis="The engineering team member who integrates translations into the product codebase."
            canDo={[
              "Publish bundles to Dev and QA environments",
              "Export translation bundles as JSON for integration",
              "Import translation CSVs from external agencies",
              "View deployment history and version diffs",
              "Access API endpoints for programmatic integration",
            ]}
            cannotDo={[
              "Edit master English copy or translations",
              "Approve or reject translations",
              "Promote bundles to Production",
            ]}
          />

          <RoleCard
            code="FN"
            name="Founder"
            whoIsThis="Business leadership with full visibility and override authority."
            canDo={[
              "Full read access to all pages, translations, and dashboards",
              "Approve translations as a final authority",
              "Promote bundles to Production",
              "Manage language configuration and system settings",
              "Override any role's workflow decision when necessary",
            ]}
            cannotDo={[
              "None - the Founder role has unrestricted access",
            ]}
          />
        </Section>

        {/* ════════════════════════════════════════════════════════════════
            7. END-TO-END WORKFLOW
        ════════════════════════════════════════════════════════════════ */}
        <Section id="workflow" title="End-to-End Workflow">
          <P>
            This is the complete step-by-step process to take a MioSalon screen from zero translations
            to fully localized and live in Production.
          </P>

          <WorkflowStep
            step={1}
            title="Register the Page"
            role="PM"
            details={[
              "Go to Content tab and click '+ Create Page'.",
              "Enter a unique Page ID (e.g., POS_QUICK_SALE) - this cannot be changed later.",
              "Enter a display name (e.g., 'Quick Sale') and select the module (e.g., 'Point of Sale').",
              "Click Create. The page now appears in the Content list with 0 tags.",
            ]}
          />

          <WorkflowStep
            step={2}
            title="Add Tags (Translatable Strings)"
            role="PM"
            details={[
              "Open the page you just created.",
              "Click '+ Add Tag' and enter the Tag ID (e.g., POS_BTN_CHECKOUT).",
              "Select the copy type: Button, Label, Header, Placeholder, Error Message, Tooltip, etc.",
              "Type the master English string (e.g., 'Proceed to Checkout').",
              "Repeat for every string on that screen. A typical page has 15–50 tags.",
            ]}
          />

          <WorkflowStep
            step={3}
            title="Generate AI Translations"
            role="PM"
            details={[
              "On the page toolbar, click 'Translate All'.",
              "The AI engine processes every tag and generates a draft translation for each active language.",
              "Each translation gets a confidence score (0–100%).",
              "Translations above the threshold (default 85%) may be auto-approved. Those below go to the reviewer queue.",
              "This step typically completes in under 30 seconds for a page with 50 tags.",
            ]}
          />

          <WorkflowStep
            step={4}
            title="Review Translations"
            role="LR"
            details={[
              "Language Reviewers go to My Work to see their review queue.",
              "Each item shows: the tag ID, page name, English source text, AI translation, and confidence score.",
              "The reviewer reads the English source, compares it with the AI translation, and decides:",
              "• Approve - the translation is correct and ready for publishing.",
              "• Edit & Approve - minor correction needed, reviewer fixes it and approves.",
              "• Reject - the translation is fundamentally wrong, needs retranslation.",
              "Reviewers can also check the back-translation (target → English) as a quality signal.",
            ]}
          />

          <WorkflowStep
            step={5}
            title="Resolve Stale Strings"
            role="LR"
            details={[
              "When a PM updates the English copy of an existing tag, all its translations become Stale.",
              "Stale translations appear in My Work → Stale Translations queue.",
              "Each row shows the English change diff (old text → new text) and how long ago it became stale.",
              "The reviewer either confirms the existing translation still works, or triggers a retranslation.",
              "Stale strings must be resolved before the page can be published again.",
            ]}
          />

          <WorkflowStep
            step={6}
            title="Publish to Dev"
            role="PM or DEV"
            details={[
              "On the Page Detail or Deployments page, click 'Publish' → select 'Dev'.",
              "MioTranslate packages all approved translations into a versioned bundle (e.g., v1).",
              "The bundle is deployed to the Dev environment for integration testing.",
              "Developers verify that translations render correctly in the UI - checking for truncation, layout issues, and RTL alignment.",
            ]}
          />

          <WorkflowStep
            step={7}
            title="Promote to QA"
            role="PM or DEV"
            details={[
              "On the Deployments page, find the bundle and click 'Promote → QA'.",
              "The exact same bundle (same version, same content) is now active in the QA environment.",
              "The QA team tests translations in context - verifying them in real user flows, not just in isolation.",
              "Any issues found are reported back. The PM or reviewer fixes the source, and a new version is published.",
            ]}
          />

          <WorkflowStep
            step={8}
            title="Promote to Production"
            role="SR or FN"
            details={[
              "Only Senior Reviewers or Founders can promote to Production.",
              "On the Deployments page, click 'Promote → Production'.",
              "The bundle goes live. Customers in that language now see the updated translations.",
              "This step is irreversible in terms of user impact - always ensure QA sign-off before promoting.",
            ]}
          />

          <WorkflowStep
            step={9}
            title="Monitor Coverage"
            role="PM"
            details={[
              "Go to the Coverage Dashboard to see translation readiness across all pages and languages.",
              "Green (≥90%) - ready for release.",
              "Blue (60–89%) - active translation in progress, significant work done.",
              "Amber (<60%) - early stage, needs attention before the next release.",
              "Aim for 100% on all active locales before major product releases.",
            ]}
          />
        </Section>

        {/* ════════════════════════════════════════════════════════════════
            8. FEATURE GUIDE
        ════════════════════════════════════════════════════════════════ */}
        <Section id="features" title="Feature Guide">
          <SubSection title="Content Tab (Pages)">
            <P>
              The main hub for managing pages and tags. Shows all registered pages with their module,
              total tags, and coverage per language. Use the search bar and filters to find specific pages.
            </P>
            <BulletList items={[
              "Click any page name to open its detail view with the full tag list.",
              "Use 'Translate All' to batch-generate AI translations for all untranslated tags.",
              "Use 'Export → CSV' to download tags for offline review or external agency work.",
              "Use 'Import → CSV' to upload corrected translations back into the system.",
            ]} />
          </SubSection>

          <SubSection title="Tag Detail View">
            <P>
              The detailed view for a single translatable string. This is where reviewers spend most of their time.
            </P>
            <BulletList items={[
              "View the master English copy and all language translations side by side.",
              "Edit translations directly (for reviewers) or trigger AI retranslation.",
              "Check the confidence score and back-translation for quality assurance.",
              "Read and write discussion comments - useful for explaining context, tone, or constraints.",
              "View version history to see how the English copy and translations have changed over time.",
              "See deployment status - which version of this tag is live in Dev, QA, and Production.",
            ]} />
          </SubSection>

          <SubSection title="My Work">
            <P>
              Your personal task queue. Shows items that need your attention based on your role.
            </P>
            <BulletList items={[
              "Pending Review - translations waiting for your approval (Language Reviewers).",
              "Stale Translations - previously approved translations that need re-verification because the English changed.",
              "Items are sorted by priority: stale items first, then low-confidence AI translations, then high-confidence ones.",
            ]} />
          </SubSection>

          <SubSection title="Coverage Dashboard">
            <P>
              A bird's-eye view of localization readiness. Shows every page × every language as a coverage percentage.
            </P>
            <BulletList items={[
              "Use this before every major release to identify gaps.",
              "Click any cell to drill down into the specific page and language combination.",
              "The summary cards at the top show total strings, overall coverage, and stale count.",
            ]} />
          </SubSection>

          <SubSection title="Deployments">
            <P>
              Tracks the version status of every page across Dev, QA, and Production.
            </P>
            <BulletList items={[
              "See which bundle version is currently active in each environment.",
              "Click 'Publish' to create a new bundle. Click 'Promote' to move it to the next environment.",
              "View the deployment history log - who published what, when, and to which environment.",
            ]} />
          </SubSection>

          <SubSection title="Settings">
            <P>
              System-wide configuration. Access is restricted by role.
            </P>
            <BulletList items={[
              "Languages - Add, edit, or disable languages. Set text direction (LTR/RTL).",
              "AI Configuration - Choose translation model, set confidence thresholds, enable/disable auto-approval.",
              "Data Import/Export - Bulk upload translations from CSV or download the entire translation database.",
              "Team - View team members and their assigned roles.",
            ]} />
          </SubSection>
        </Section>

        {/* ════════════════════════════════════════════════════════════════
            9. BEST PRACTICES
        ════════════════════════════════════════════════════════════════ */}
        <Section id="best-practices" title="Best Practices">
          <div className="flex flex-col gap-5">
            <BestPracticeItem
              icon={Lightbulb}
              title="Write Clear, Unambiguous English"
              description="Avoid single words that could mean different things. Instead of 'Set', write 'Set Appointment' or 'Settings'. Instead of 'Book', write 'Book Appointment'. The AI translates dramatically better with clear context. This is the single most impactful thing a PM can do for translation quality."
            />
            <BestPracticeItem
              icon={ListChecks}
              title="Use Consistent Terminology"
              description="Decide on standard terms and stick to them across all pages. Always use 'Appointment' (never 'Booking'). Always use 'Client' (never 'Customer'). Consistency in English = consistency in every language."
            />
            <BestPracticeItem
              icon={Clock}
              title="Resolve Stale Translations Within 24 Hours"
              description="When English copy changes, don't let stale translations pile up. The longer they sit, the harder it is to remember the context of the change. Aim to resolve stale items within one business day."
            />
            <BestPracticeItem
              icon={Eye}
              title="Never Skip the Review Step"
              description="Even high-confidence AI translations (90%+) can miss cultural nuances, gender forms, honorifics, or domain-specific jargon. A 95% confidence score means the AI thinks it's right - but a native speaker knows for sure."
            />
            <BestPracticeItem
              icon={MessageSquare}
              title="Leave Comments for Context"
              description="When a tag's meaning isn't obvious from the English text alone, leave a comment explaining the context. Example: 'This button appears on the checkout screen. Max 12 characters due to layout constraints. Formal tone.'"
            />
            <BestPracticeItem
              icon={Rocket}
              title="Always Publish Dev → QA → Production (In Order)"
              description="Never skip environments. A translation might look correct in a spreadsheet but break the UI due to text length, special characters, or RTL rendering. Dev catches integration bugs. QA catches user-flow bugs."
            />
            <BestPracticeItem
              icon={Target}
              title="Aim for 100% Coverage Before Releases"
              description="Untranslated strings fall back to English. A Tamil-speaking salon owner seeing random English buttons creates confusion and support tickets. Check the Coverage Dashboard before every release."
            />
            <BestPracticeItem
              icon={Tag}
              title="Follow the Tag Naming Convention"
              description="Use the format: MODULE_ELEMENT_PURPOSE. Examples: POS_BTN_CHECKOUT, CAL_LBL_DATE, INV_MSG_SENT_SUCCESS. This makes searching, filtering, and debugging straightforward for everyone."
            />
          </div>
        </Section>

        {/* ════════════════════════════════════════════════════════════════
            10. WHAT NOT TO DO
        ════════════════════════════════════════════════════════════════ */}
        <Section id="what-not-to-do" title="What NOT To Do">
          <Callout type="warning">
            These are common mistakes that cause real problems. Read them carefully.
          </Callout>
          <div className="flex flex-col gap-4 mt-4">
            <DontItem
              title="Don't publish to Production without QA sign-off"
              description="Even if the Coverage Dashboard shows 100%, translations need to be tested in context. A perfectly translated button label can still break the UI if it's too long for the layout."
            />
            <DontItem
              title="Don't ignore stale translations"
              description="Stale ≠ wrong. But stale = unverified. A stale translation might still be correct, or it might now say something misleading because the English meaning changed. Always verify."
            />
            <DontItem
              title="Don't edit English copy without notifying reviewers"
              description="When you change the master English text, every translation for that tag becomes stale. If you change 50 tags at once, reviewers suddenly have 50 × (number of languages) items in their queue. Coordinate with the team."
            />
            <DontItem
              title="Don't auto-approve everything to hit coverage targets"
              description="It's tempting to bulk-approve all AI translations to reach 100% coverage before a deadline. This defeats the purpose of the review step and risks shipping wrong translations to customers."
            />
            <DontItem
              title="Don't use the same Tag ID on different pages"
              description="Each tag should be unique to its page. Even if two pages have a 'Save' button, they should have separate tags (e.g., CAL_BTN_SAVE and POS_BTN_SAVE) because the context may differ across languages."
            />
            <DontItem
              title="Don't hardcode translated strings in code"
              description="All translated text must come from MioTranslate bundles. Never paste a translation directly into a code file. If the translation changes, the code won't update until the next code release."
            />
            <DontItem
              title="Don't delete a page or tag without checking deployments"
              description="If a page or tag is referenced in a production bundle, deleting it from MioTranslate won't remove it from the live product - but it will prevent future updates. Archive instead of delete."
            />
          </div>
        </Section>

        {/* ════════════════════════════════════════════════════════════════
            11. FAQ
        ════════════════════════════════════════════════════════════════ */}
        <Section id="faq" title="Frequently Asked Questions">
          {faqData.map((item, idx) => (
            <div key={idx} className="border-b border-[#EBECF0] last:border-b-0">
              <button
                onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                className="w-full py-4 flex items-start justify-between text-left cursor-pointer hover:bg-[#FAFBFC] transition-colors px-1"
              >
                <span className="text-[14px] font-semibold text-[#172B4D] pr-4 leading-snug">{item.q}</span>
                <ChevronRight className={`w-4 h-4 text-[#6B778C] shrink-0 mt-0.5 transition-transform ${expandedFaq === idx ? "rotate-90" : ""}`} />
              </button>
              {expandedFaq === idx && (
                <div className="px-1 pb-4 text-[13px] text-[#42526E] leading-relaxed">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </Section>
      </div>
    </div>
  );
}

/* ─── SECTION ─── */
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-8 scroll-mt-28">
      <h2 className="text-[18px] font-bold text-[#172B4D] mb-4">{title}</h2>
      <div className="bg-white rounded-xl border border-[#DFE1E6] px-6 py-6 lg:px-8 lg:py-7 shadow-sm">
        {children}
      </div>
    </section>
  );
}

/* ─── SUB-SECTION ─── */
function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 first:mt-0">
      <h3 className="text-[15px] font-bold text-[#172B4D] mb-2">{title}</h3>
      {children}
    </div>
  );
}

/* ─── PARAGRAPH ─── */
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-[#42526E] leading-relaxed mb-3 last:mb-0">{children}</p>;
}

/* ─── BULLET LIST ─── */
function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5 mt-2 mb-3 last:mb-0">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[13px] text-[#42526E] leading-relaxed">
          <span className="w-1.5 h-1.5 rounded-full bg-[#A5ADBA] shrink-0 mt-2"></span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ─── CALLOUT ─── */
function Callout({ type, children }: { type: "info" | "warning"; children: React.ReactNode }) {
  const styles = {
    info: { bg: "#DEEBFF", border: "#B3D4FF", text: "#0747A6", icon: Lightbulb },
    warning: { bg: "#FFF0B3", border: "#FFE380", text: "#172B4D", icon: AlertTriangle },
  };
  const s = styles[type];
  const Icon = s.icon;
  return (
    <div className="rounded-lg p-4 flex items-start gap-3 text-[13px] leading-relaxed mt-3" style={{ backgroundColor: s.bg, borderColor: s.border, color: s.text, border: `1px solid ${s.border}` }}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

/* ─── STATUS PILL ─── */
function StatusPill({ color, text, border, children }: { color: string; text: string; border: string; children: React.ReactNode }) {
  return (
    <span className="px-3 py-1.5 rounded text-[12px] font-semibold" style={{ backgroundColor: color, color: text, border: `1px solid ${border}` }}>
      {children}
    </span>
  );
}

/* ─── GUIDE ITEM ─── */
function GuideItem({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-[#F4F5F7] text-[#42526E] flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 stroke-[1.5]" />
      </div>
      <div>
        <h3 className="text-[14px] font-bold text-[#172B4D] mb-1 leading-tight">{title}</h3>
        <p className="text-[13px] text-[#5E6C84] leading-relaxed m-0">{description}</p>
      </div>
    </div>
  );
}

/* ─── GLOSSARY ROW ─── */
function GlossaryRow({ term, definition }: { term: string; definition: string }) {
  return (
    <div className="py-3 border-b border-[#EBECF0] last:border-b-0 flex items-start gap-4">
      <span className="text-[13px] font-bold text-[#0747A6] w-40 shrink-0">{term}</span>
      <span className="text-[13px] text-[#42526E] leading-relaxed">{definition}</span>
    </div>
  );
}

/* ─── ROLE CARD ─── */
function RoleCard({ code, name, whoIsThis, canDo, cannotDo }: { code: string; name: string; whoIsThis: string; canDo: string[]; cannotDo: string[] }) {
  return (
    <div className="mt-5 first:mt-0 border border-[#EBECF0] rounded-lg p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="w-9 h-9 rounded bg-[#DEEBFF] text-[#0747A6] flex items-center justify-center text-[12px] font-bold">{code}</span>
        <div>
          <h3 className="text-[14px] font-bold text-[#172B4D] leading-tight">{name}</h3>
          <p className="text-[12px] text-[#6B778C] m-0">{whoIsThis}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <span className="text-[11px] font-bold text-[#006644] uppercase tracking-wider mb-2 block">Can Do</span>
          <ul className="flex flex-col gap-1.5">
            {canDo.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-[#42526E]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#36B37E] shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <span className="text-[11px] font-bold text-[#BF2600] uppercase tracking-wider mb-2 block">Cannot Do</span>
          <ul className="flex flex-col gap-1.5">
            {cannotDo.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-[#42526E]">
                <XCircle className="w-3.5 h-3.5 text-[#DE350B] shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ─── WORKFLOW STEP ─── */
function WorkflowStep({ step, title, role, details }: { step: number; title: string; role: string; details: string[] }) {
  return (
    <div className="mt-5 first:mt-0 flex gap-4">
      <div className="w-8 h-8 rounded-full bg-[#0052CC] text-white flex items-center justify-center text-[13px] font-bold shrink-0 mt-0.5">
        {step}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <h3 className="text-[14px] font-bold text-[#172B4D]">{title}</h3>
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#F4F5F7] text-[#6B778C] border border-[#EBECF0]">{role}</span>
        </div>
        <ul className="flex flex-col gap-1 mb-0">
          {details.map((d, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[13px] text-[#42526E] leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A5ADBA] shrink-0 mt-2"></span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── BEST PRACTICE ITEM ─── */
function BestPracticeItem({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-9 h-9 rounded-lg bg-[#F4F5F7] text-[#42526E] flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 stroke-[1.5]" />
      </div>
      <div>
        <h3 className="text-[14px] font-bold text-[#172B4D] mb-1 leading-tight">{title}</h3>
        <p className="text-[13px] text-[#5E6C84] leading-relaxed m-0">{description}</p>
      </div>
    </div>
  );
}

/* ─── DONT ITEM ─── */
function DontItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <Ban className="w-4.5 h-4.5 text-[#DE350B] shrink-0 mt-0.5" />
      <div>
        <h3 className="text-[14px] font-bold text-[#172B4D] mb-0.5 leading-tight">{title}</h3>
        <p className="text-[13px] text-[#5E6C84] leading-relaxed m-0">{description}</p>
      </div>
    </div>
  );
}

/* ─── FAQ DATA ─── */
const faqData = [
  {
    q: "What happens if I update the English copy after translations are already approved?",
    a: "All translations for that tag across every language are automatically flagged as 'Stale'. They appear in the reviewer's My Work queue. The reviewer can either confirm the existing translation still applies, or trigger a retranslation. The stale translations are excluded from new bundles until resolved.",
  },
  {
    q: "Can I edit a translation directly without using AI?",
    a: "Yes. On the Tag Detail page, click 'Edit' next to the translation for any language. Type the correct translation and save it. This is useful when you have a known-good translation from a professional agency, or when the AI consistently gets a specific term wrong.",
  },
  {
    q: "What is the difference between Publish and Promote?",
    a: "Publish creates a NEW versioned bundle from the current approved translations and deploys it to Dev. Promote takes an EXISTING bundle that's already been tested in a lower environment and moves it up - Dev → QA, or QA → Production. You publish once, then promote the same bundle upward through environments.",
  },
  {
    q: "How do I add a new language to the system?",
    a: "Go to Settings → Languages → Add Language. Enter the ISO language code (e.g., 'ta' for Tamil), display name, native label (e.g., 'தமிழ்'), and text direction (LTR or RTL). Once added, every existing page will show 0% coverage for that language, and tags will appear in the review queue when AI translations are generated.",
  },
  {
    q: "What does the confidence score mean? When should I worry?",
    a: "The confidence score (0–100%) is the AI's self-assessed certainty about its translation. Above 85%: the AI is highly confident and the translation is likely correct - but still verify. 70–85%: moderate confidence - the AI struggled with some aspect (context, formality, technical term). Expect corrections. Below 70%: low confidence - the AI isn't sure. Almost always needs human editing.",
  },
  {
    q: "Can I export translations to send to an external agency?",
    a: "Yes. On any Page Detail view, click 'Export → CSV'. This downloads all tags with their English copy and current translations. The agency fills in or corrects the translations in the CSV, and you re-import it via Settings → Data Import/Export. The imported translations will enter the review queue.",
  },
  {
    q: "Who can publish to Production?",
    a: "Only the Senior Reviewer (SR) and Founder (FN) roles can promote bundles to the Production environment. Product Managers and Developers can publish to Dev and QA, but they cannot push translations to the live product. This is a safety mechanism.",
  },
  {
    q: "What happens to untranslated strings in Production?",
    a: "Untranslated strings fall back to the master English copy. So a Tamil-speaking user would see most of the interface in Tamil, but untranslated buttons or messages would appear in English. This creates a jarring, unprofessional experience - which is why aiming for 100% coverage before releases is critical.",
  },
  {
    q: "Can I undo a Production deployment?",
    a: "You cannot 'rollback' a bundle in the traditional sense. However, you can publish a new bundle with corrected translations and promote it to Production. The previous version remains in the deployment history for reference. In urgent cases, the Founder role can fast-track a promotion.",
  },
  {
    q: "How do I know if a translation is wrong in Production?",
    a: "Three ways: (1) Customer support tickets mentioning confusing text in a specific language. (2) The Coverage Dashboard showing stale strings that were promoted before being resolved. (3) The back-translation check - if the AI's reverse translation doesn't match the original English, the forward translation may be wrong.",
  },
  {
    q: "What is a back-translation?",
    a: "A back-translation is an AI-generated reverse translation: it takes the translated text and translates it back to English. If the back-translation matches the original English closely, the forward translation is likely correct. If it diverges significantly, the translation may have errors or lost meaning in translation.",
  },
  {
    q: "I'm from the Support team. What do I need to know?",
    a: "As a Support team member, you primarily need to understand: (1) Coverage - if a customer reports seeing English text in their local language, check the Coverage Dashboard for that page. (2) Stale - if a customer reports outdated text, the translation may be stale. (3) Environments - ask which version they're on. A fix might already be in QA but not yet in Production. You can view all pages and translations but cannot edit them.",
  },
  {
    q: "I'm from the Sales team. What do I need to know?",
    a: "You need to know which languages are supported and how complete each one is. Go to the Coverage Dashboard - it shows every page and every language with a percentage. When speaking with prospects, you can say 'MioSalon is available in X languages' and give accurate coverage numbers. Never promise 100% in a language unless the dashboard confirms it.",
  },
];
