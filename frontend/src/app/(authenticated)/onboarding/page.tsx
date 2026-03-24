"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Users, Zap, Rocket, ArrowRight, ArrowLeft } from "lucide-react";
import { useApi } from "@/lib/useApi";

interface StepProps {
  onNext: (data: Record<string, string>) => void;
  onBack?: () => void;
  context: Record<string, string>;
}

function RoleStep({ onNext }: StepProps) {
  const [selected, setSelected] = useState("");

  const roles = [
    { id: "developer", icon: <Zap size={20} />, title: "Developer", desc: "Building and deploying AI agents" },
    { id: "team_lead", icon: <Users size={20} />, title: "Team Lead", desc: "Managing agent teams and workflows" },
    { id: "researcher", icon: <Bot size={20} />, title: "Researcher", desc: "Experimenting with multi-agent systems" },
    { id: "other", icon: <Rocket size={20} />, title: "Other", desc: "Exploring what SharkSwarm can do" },
  ];

  return (
    <div className="onboarding-card">
      <h2>What brings you here?</h2>
      <p>This helps us tailor your experience.</p>
      <div className="onboarding-options">
        {roles.map((role) => (
          <div
            key={role.id}
            className={`onboarding-option ${selected === role.id ? "selected" : ""}`}
            onClick={() => setSelected(role.id)}
          >
            <span className="onboarding-option-icon">{role.icon}</span>
            <div className="onboarding-option-text">
              <h4>{role.title}</h4>
              <p>{role.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="onboarding-actions">
        <div />
        <button
          className="primary"
          disabled={!selected}
          onClick={() => onNext({ role: selected })}
        >
          Continue <ArrowRight size={14} style={{ marginLeft: 4, verticalAlign: "middle" }} />
        </button>
      </div>
    </div>
  );
}

function WorkspaceStep({ onNext, onBack, context }: StepProps) {
  const [name, setName] = useState("");
  const [teamSize, setTeamSize] = useState("");

  const sizes = [
    { id: "solo", label: "Just me" },
    { id: "small", label: "2-5 people" },
    { id: "medium", label: "6-20 people" },
    { id: "large", label: "20+ people" },
  ];

  return (
    <div className="onboarding-card">
      <h2>Set up your workspace</h2>
      <p>Give your workspace a name and tell us about your team.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
        <div className="form-group">
          <label className="form-label">
            Workspace name <span className="required">*</span>
          </label>
          <input
            placeholder="e.g. Acme AI Lab"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Team size</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {sizes.map((s) => (
              <div
                key={s.id}
                className={`onboarding-option ${teamSize === s.id ? "selected" : ""}`}
                onClick={() => setTeamSize(s.id)}
                style={{ justifyContent: "center" }}
              >
                <span style={{ fontSize: 13 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="onboarding-actions">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={14} style={{ marginRight: 4, verticalAlign: "middle" }} /> Back
        </button>
        <button
          className="primary"
          disabled={!name.trim()}
          onClick={() => onNext({ workspaceName: name.trim(), teamSize })}
        >
          Continue <ArrowRight size={14} style={{ marginLeft: 4, verticalAlign: "middle" }} />
        </button>
      </div>
    </div>
  );
}

function FirstAgentStep({ onNext, onBack }: StepProps) {
  const api = useApi();
  const [agentName, setAgentName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!agentName.trim()) return;
    setCreating(true);
    try {
      await api("/api/agents", {
        method: "POST",
        body: JSON.stringify({
          name: agentName.trim(),
          systemPrompt: `You are ${agentName.trim()}, an AI agent in the SharkSwarm multi-agent system.`,
          model: "openai/gpt-4.1-mini",
          tools: [],
        }),
      });
      onNext({ firstAgent: agentName.trim() });
    } catch {
      // Allow skipping if API fails
      onNext({ firstAgent: "" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="onboarding-card">
      <h2>Create your first agent</h2>
      <p>Agents are the building blocks of your swarm. Start with one and scale up.</p>
      <div style={{ marginBottom: 24 }}>
        <div className="form-group">
          <label className="form-label">Agent name</label>
          <input
            placeholder="e.g. Research Agent"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
          />
          <span className="form-hint">You can always create more agents later.</span>
        </div>
      </div>
      <div className="onboarding-actions">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={14} style={{ marginRight: 4, verticalAlign: "middle" }} /> Back
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onNext({ firstAgent: "" })}>Skip</button>
          <button
            className="primary"
            disabled={!agentName.trim() || creating}
            onClick={handleCreate}
          >
            {creating ? "Creating..." : "Create & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { id: "role", component: RoleStep },
  { id: "workspace", component: WorkspaceStep },
  { id: "first-agent", component: FirstAgentStep },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [context, setContext] = useState<Record<string, string>>({});

  const handleNext = async (data: Record<string, string>) => {
    const newContext = { ...context, ...data };
    setContext(newContext);

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      // Save progress
      try {
        await fetch("/api/onboarding/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: STEPS[currentStep + 1].id, context: newContext }),
        });
      } catch {
        // non-blocking
      }
    } else {
      // Complete onboarding
      try {
        await fetch("/api/onboarding/complete", { method: "POST" });
      } catch {
        // non-blocking
      }
      router.push("/dashboard");
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const StepComponent = STEPS[currentStep].component;

  return (
    <div className="onboarding-container">
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <span className="sidebar-logo" style={{ width: 40, height: 40, fontSize: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 10, marginBottom: 16 }}>S</span>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Step {currentStep + 1} of {STEPS.length}</p>
      </div>

      <div className="onboarding-progress">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`onboarding-dot ${i === currentStep ? "active" : ""} ${i < currentStep ? "complete" : ""}`}
          />
        ))}
      </div>

      <StepComponent
        onNext={handleNext}
        onBack={currentStep > 0 ? handleBack : undefined}
        context={context}
      />
    </div>
  );
}
