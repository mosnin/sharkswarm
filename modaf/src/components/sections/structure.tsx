"use client";

import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { BorderBeam } from "@/components/ui/border-beam";
import { Tree, type TreeViewElement } from "@/components/ui/file-tree";

const treeElements: TreeViewElement[] = [
  {
    id: "docs",
    name: "docs/framework/",
    type: "folder",
    children: [
      { id: "qs", name: "QUICK_START.md", type: "file" },
      { id: "gl", name: "GLOSSARY.md", type: "file" },
      { id: "mf", name: "MANIFEST.md", type: "file" },
      {
        id: "website",
        name: "website/",
        type: "folder",
        children: [
          { id: "w1", name: "saas_home_page_system.md", type: "file" },
          { id: "w9", name: "saas_website_page_system.md", type: "file" },
          { id: "w2", name: "design_system_tokens.md", type: "file" },
          { id: "w3", name: "public_component_specs.md", type: "file" },
          { id: "w4", name: "public_copy_conversion_rules.md", type: "file" },
          { id: "w5", name: "public_screen_archetypes.md", type: "file" },
          { id: "w6", name: "component_library_spec.md", type: "file" },
          { id: "w7", name: "nextjs_folder_structure.md", type: "file" },
          { id: "w8", name: "sitemap_diagram.md", type: "file" },
        ],
      },
      {
        id: "internal",
        name: "internal/",
        type: "folder",
        children: [
          { id: "i1", name: "01_app_shell.md", type: "file" },
          { id: "i2", name: "02_auth_and_onboarding.md", type: "file" },
          { id: "i3", name: "03_dashboard_system.md", type: "file" },
          { id: "i4", name: "04_feature_modules.md", type: "file" },
          { id: "i5", name: "05_settings_billing_admin.md", type: "file" },
          { id: "i6", name: "06_routes_and_permissions.md", type: "file" },
          { id: "i7", name: "07_data_models.md", type: "file" },
          { id: "i8", name: "08_ui_system_internal.md", type: "file" },
          { id: "i9", name: "09_build_rules_internal.md", type: "file" },
          { id: "i10", name: "10_design_tokens_internal.md", type: "file" },
          { id: "i11", name: "11_internal_screen_archetypes.md", type: "file" },
          { id: "i12", name: "12_internal_component_specs.md", type: "file" },
          { id: "i13", name: "13_internal_data_display_rules.md", type: "file" },
          { id: "i14", name: "14_email_system.md", type: "file" },
          { id: "i15", name: "15_canonical_breakpoints.md", type: "file" },
          { id: "i16", name: "16_dashboard_archetypes.md", type: "file" },
          { id: "i17", name: "17_error_state_taxonomy.md", type: "file" },
          { id: "i18", name: "18_testing_strategy.md", type: "file" },
          { id: "i19", name: "19_i18n_posture.md", type: "file" },
          { id: "i20", name: "20_subagent_dispatch.md", type: "file" },
          { id: "i21", name: "21_validation_gates.md", type: "file" },
          { id: "i22", name: "22_pattern_snapshot.md", type: "file" },
          { id: "i23", name: "23_escape_hatches.md", type: "file" },
          { id: "i24", name: "24_error_recovery.md", type: "file" },
          { id: "i25", name: "25_doctor_mode.md", type: "file" },
          { id: "i26", name: "26_observability.md", type: "file" },
          { id: "i27", name: "27_performance.md", type: "file" },
          { id: "i28", name: "28_accessibility.md", type: "file" },
        ],
      },
      {
        id: "templates",
        name: "templates/",
        type: "folder",
        children: [
          { id: "t1", name: "00_app_idea_template.md", type: "file" },
          { id: "t2", name: "01_project_brief_template.md", type: "file" },
          { id: "t3", name: "02_feature_spec_template.md", type: "file" },
          { id: "t4", name: "03_user_flows_template.md", type: "file" },
          { id: "t5", name: "04_edge_cases_template.md", type: "file" },
          { id: "t6", name: "05_tech_stack_template.md", type: "file" },
          { id: "t7", name: "06_permissions_matrix_template.md", type: "file" },
          { id: "t8", name: "07_acceptance_criteria_template.md", type: "file" },
          { id: "t9", name: "08_qa_checklist_template.md", type: "file" },
        ],
      },
      {
        id: "phases",
        name: "phases/",
        type: "folder",
        children: [
          { id: "p1", name: "phase_00_welcome.md", type: "file" },
          { id: "p2", name: "phase_01_discovery.md", type: "file" },
          { id: "p3", name: "phase_02_project_docs.md", type: "file" },
          { id: "p4", name: "...", type: "file" },
          { id: "p5", name: "phase_14_polish.md", type: "file" },
        ],
      },
    ],
  },
];

const techStack = [
  { name: "Next.js", color: "border-white/20 text-white/70" },
  { name: "TypeScript", color: "border-cyan/30 text-cyan" },
  { name: "Tailwind CSS", color: "border-cyan/30 text-cyan" },
  { name: "shadcn/ui", color: "border-white/20 text-white/70" },
  { name: "Prisma", color: "border-magenta/30 text-magenta" },
  { name: "PostgreSQL", color: "border-cyan/30 text-cyan" },
  { name: "Auth.js", color: "border-yellow/30 text-yellow" },
  { name: "Stripe", color: "border-magenta/30 text-magenta" },
  { name: "Resend", color: "border-white/20 text-white/70" },
  { name: "Motion", color: "border-yellow/30 text-yellow" },
  { name: "Vercel", color: "border-white/20 text-white/70" },
  { name: "Vitest", color: "border-yellow/30 text-yellow" },
];

export function StructureSection() {
  return (
    <section id="structure" className="py-20 md:py-32 px-4 sm:px-6 overflow-hidden">
      <div className="mx-auto max-w-5xl w-full">
        <ScrollReveal>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-yellow mb-2">
            Repository Structure
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-[44px] font-bold leading-tight">
            Documentation that
            <br />
            <span className="text-yellow">builds software</span>
          </h2>
          <p className="mt-4 text-lg text-white/50 max-w-xl">
            MODAF contains no code, only structured documentation that guides
            your AI agent through every decision. Four directories, each with a
            clear purpose.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div className="mt-12 relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6 md:p-8">
            <Tree
              elements={treeElements}
              initialExpandedItems={["docs", "website", "internal", "templates", "phases"]}
              className="text-white/70 [&_button]:text-white/70 [&_svg]:text-white/40 [&_button:hover]:text-white [&_.bg-muted]:bg-white/10"
              sort="none"
            />
            <BorderBeam
              size={100}
              duration={16}
              colorFrom="#FFE500"
              colorTo="#FFE500"
              borderWidth={1}
            />
          </div>
        </ScrollReveal>

        {/* Tech stack */}
        <ScrollReveal delay={0.2}>
          <div className="mt-16">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/30 text-center mb-6">
              Default tech stack
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {techStack.map((tech) => (
                <span
                  key={tech.name}
                  className={`px-4 py-2 text-xs font-semibold rounded-full border bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.06] transition-colors duration-200 ${tech.color}`}
                >
                  {tech.name}
                </span>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
