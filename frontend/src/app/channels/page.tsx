"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface Agent {
  id: string;
  name: string;
  status: string;
}

interface ChannelStatus {
  [channel: string]: "connected" | "disconnected" | "not configured" | string;
}

interface ChannelConfig {
  telegram?: { token?: string; allowFrom?: string; groupPolicy?: string };
  whatsapp?: { enabled?: boolean; allowFrom?: string; groupPolicy?: string };
  discord?: { token?: string; guildId?: string; allowFrom?: string; groupPolicy?: string };
  slack?: { appToken?: string; botToken?: string; allowFrom?: string };
  signal?: { enabled?: boolean; phoneNumber?: string };
  imessage?: { enabled?: boolean; allowFrom?: string };
  irc?: { server?: string; port?: number; nick?: string; channels?: string };
  msteams?: { appId?: string; appPassword?: string; tenantId?: string };
  googlechat?: { enabled?: boolean; credentialsPath?: string };
  [key: string]: unknown;
}

const CHANNELS = [
  { key: "telegram", label: "Telegram", icon: "paper-plane" },
  { key: "whatsapp", label: "WhatsApp", icon: "phone" },
  { key: "discord", label: "Discord", icon: "gamepad" },
  { key: "slack", label: "Slack", icon: "hashtag" },
  { key: "signal", label: "Signal", icon: "shield" },
  { key: "imessage", label: "iMessage", icon: "message" },
  { key: "irc", label: "IRC", icon: "terminal" },
  { key: "msteams", label: "MS Teams", icon: "users" },
  { key: "googlechat", label: "Google Chat", icon: "chat" },
] as const;

const CHANNEL_ICONS: Record<string, string> = {
  telegram: "\u2708",
  whatsapp: "\u260E",
  discord: "\uD83C\uDFAE",
  slack: "#",
  signal: "\uD83D\uDEE1",
  imessage: "\uD83D\uDCAC",
  irc: ">_",
  msteams: "\uD83D\uDC65",
  googlechat: "\uD83D\uDDE8",
};

function getDefaultConfig(channel: string): Record<string, unknown> {
  switch (channel) {
    case "telegram":
      return { token: "", allowFrom: "", groupPolicy: "disabled" };
    case "whatsapp":
      return { enabled: false, allowFrom: "", groupPolicy: "disabled" };
    case "discord":
      return { token: "", guildId: "", allowFrom: "", groupPolicy: "disabled" };
    case "slack":
      return { appToken: "", botToken: "", allowFrom: "" };
    case "signal":
      return { enabled: false, phoneNumber: "" };
    case "imessage":
      return { enabled: false, allowFrom: "" };
    case "irc":
      return { server: "", port: 6667, nick: "", channels: "" };
    case "msteams":
      return { appId: "", appPassword: "", tenantId: "" };
    case "googlechat":
      return { enabled: false, credentialsPath: "" };
    default:
      return {};
  }
}

export default function ChannelsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [channelStatuses, setChannelStatuses] = useState<ChannelStatus>({});
  const [channelConfigs, setChannelConfigs] = useState<ChannelConfig>({});
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const data = await api<Agent[]>("/api/agents");
      setAgents(data);
      if (data.length > 0 && !selectedAgentId) {
        setSelectedAgentId(data[0].id);
      }
    } catch {
      // ignore
    }
  }, [selectedAgentId]);

  const fetchChannelData = useCallback(async () => {
    if (!selectedAgentId) return;
    try {
      const [statuses, config] = await Promise.all([
        api<ChannelStatus>(`/api/agents/${selectedAgentId}/channels`),
        api<{ channels?: ChannelConfig }>(`/api/agents/${selectedAgentId}/config`),
      ]);
      setChannelStatuses(statuses);
      setChannelConfigs(config.channels || {});
    } catch {
      setChannelStatuses({});
      setChannelConfigs({});
    }
  }, [selectedAgentId]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (selectedAgentId) {
      setActiveChannel(null);
      fetchChannelData();
    }
  }, [selectedAgentId, fetchChannelData]);

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const openConfig = (channelKey: string) => {
    if (activeChannel === channelKey) {
      setActiveChannel(null);
      return;
    }
    const existing = channelConfigs[channelKey] as Record<string, unknown> | undefined;
    const defaults = getDefaultConfig(channelKey);
    setFormData({ ...defaults, ...existing });
    setActiveChannel(channelKey);
  };

  const handleSave = async () => {
    if (!selectedAgentId || !activeChannel) return;
    setSaving(true);
    try {
      await api(`/api/agents/${selectedAgentId}/config`, {
        method: "PUT",
        body: JSON.stringify({
          channels: {
            ...channelConfigs,
            [activeChannel]: formData,
          },
        }),
      });
      showMessage("Channel configuration saved.", "success");
      await fetchChannelData();
    } catch {
      showMessage("Failed to save configuration.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async (channelKey: string) => {
    if (!selectedAgentId) return;
    setLoggingOut(channelKey);
    try {
      await api(`/api/agents/${selectedAgentId}/gateway/channels.logout`, {
        method: "POST",
        body: JSON.stringify({ channel: channelKey }),
      });
      showMessage(`Logged out of ${channelKey}.`, "success");
      await fetchChannelData();
    } catch {
      showMessage(`Failed to logout from ${channelKey}.`, "error");
    } finally {
      setLoggingOut(null);
    }
  };

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const getStatusColor = (status: string | undefined) => {
    if (!status || status === "not configured") return "var(--text-muted)";
    if (status === "connected") return "var(--green)";
    if (status === "disconnected") return "var(--red)";
    return "var(--yellow)";
  };

  const getStatusLabel = (channelKey: string) => {
    const status = channelStatuses[channelKey];
    if (!status) return "Not Configured";
    if (status === "connected") return "Connected";
    if (status === "disconnected") return "Disconnected";
    return status;
  };

  const labelStyle = {
    fontSize: 13,
    color: "var(--text-muted)",
    display: "block",
    marginBottom: 4,
  } as const;

  const cardStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 16,
  } as const;

  const renderConfigForm = (channelKey: string) => {
    switch (channelKey) {
      case "telegram":
        return (
          <>
            <label>
              <span style={labelStyle}>Bot Token</span>
              <input
                type="password"
                value={(formData.token as string) || ""}
                placeholder="123456:ABC-DEF..."
                onChange={(e) => updateField("token", e.target.value)}
              />
            </label>
            <label>
              <span style={labelStyle}>Allow From (comma-separated user IDs)</span>
              <input
                value={(formData.allowFrom as string) || ""}
                placeholder="user1,user2"
                onChange={(e) => updateField("allowFrom", e.target.value)}
              />
            </label>
            <label>
              <span style={labelStyle}>Group Policy</span>
              <select
                value={(formData.groupPolicy as string) || "disabled"}
                onChange={(e) => updateField("groupPolicy", e.target.value)}
              >
                <option value="open">Open</option>
                <option value="disabled">Disabled</option>
                <option value="allowlist">Allowlist</option>
              </select>
            </label>
          </>
        );

      case "whatsapp":
        return (
          <>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={!!formData.enabled}
                onChange={(e) => updateField("enabled", e.target.checked)}
              />
              <span style={{ fontSize: 13, color: "var(--text)" }}>Enabled</span>
            </label>
            <label>
              <span style={labelStyle}>Allow From (comma-separated)</span>
              <input
                value={(formData.allowFrom as string) || ""}
                placeholder="+1234567890"
                onChange={(e) => updateField("allowFrom", e.target.value)}
              />
            </label>
            <label>
              <span style={labelStyle}>Group Policy</span>
              <select
                value={(formData.groupPolicy as string) || "disabled"}
                onChange={(e) => updateField("groupPolicy", e.target.value)}
              >
                <option value="open">Open</option>
                <option value="disabled">Disabled</option>
                <option value="allowlist">Allowlist</option>
              </select>
            </label>
          </>
        );

      case "discord":
        return (
          <>
            <label>
              <span style={labelStyle}>Bot Token</span>
              <input
                type="password"
                value={(formData.token as string) || ""}
                placeholder="Discord bot token"
                onChange={(e) => updateField("token", e.target.value)}
              />
            </label>
            <label>
              <span style={labelStyle}>Guild ID</span>
              <input
                value={(formData.guildId as string) || ""}
                placeholder="Server/guild ID"
                onChange={(e) => updateField("guildId", e.target.value)}
              />
            </label>
            <label>
              <span style={labelStyle}>Allow From (comma-separated user IDs)</span>
              <input
                value={(formData.allowFrom as string) || ""}
                placeholder="user1,user2"
                onChange={(e) => updateField("allowFrom", e.target.value)}
              />
            </label>
            <label>
              <span style={labelStyle}>Group Policy</span>
              <select
                value={(formData.groupPolicy as string) || "disabled"}
                onChange={(e) => updateField("groupPolicy", e.target.value)}
              >
                <option value="open">Open</option>
                <option value="disabled">Disabled</option>
                <option value="allowlist">Allowlist</option>
              </select>
            </label>
          </>
        );

      case "slack":
        return (
          <>
            <label>
              <span style={labelStyle}>App Token</span>
              <input
                type="password"
                value={(formData.appToken as string) || ""}
                placeholder="xapp-..."
                onChange={(e) => updateField("appToken", e.target.value)}
              />
            </label>
            <label>
              <span style={labelStyle}>Bot Token</span>
              <input
                type="password"
                value={(formData.botToken as string) || ""}
                placeholder="xoxb-..."
                onChange={(e) => updateField("botToken", e.target.value)}
              />
            </label>
            <label>
              <span style={labelStyle}>Allow From (comma-separated user IDs)</span>
              <input
                value={(formData.allowFrom as string) || ""}
                placeholder="U01ABC,U02DEF"
                onChange={(e) => updateField("allowFrom", e.target.value)}
              />
            </label>
          </>
        );

      case "signal":
        return (
          <>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={!!formData.enabled}
                onChange={(e) => updateField("enabled", e.target.checked)}
              />
              <span style={{ fontSize: 13, color: "var(--text)" }}>Enabled</span>
            </label>
            <label>
              <span style={labelStyle}>Phone Number</span>
              <input
                value={(formData.phoneNumber as string) || ""}
                placeholder="+1234567890"
                onChange={(e) => updateField("phoneNumber", e.target.value)}
              />
            </label>
          </>
        );

      case "imessage":
        return (
          <>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={!!formData.enabled}
                onChange={(e) => updateField("enabled", e.target.checked)}
              />
              <span style={{ fontSize: 13, color: "var(--text)" }}>Enabled</span>
            </label>
            <label>
              <span style={labelStyle}>Allow From (comma-separated)</span>
              <input
                value={(formData.allowFrom as string) || ""}
                placeholder="user@icloud.com,+1234567890"
                onChange={(e) => updateField("allowFrom", e.target.value)}
              />
            </label>
          </>
        );

      case "irc":
        return (
          <>
            <label>
              <span style={labelStyle}>Server</span>
              <input
                value={(formData.server as string) || ""}
                placeholder="irc.libera.chat"
                onChange={(e) => updateField("server", e.target.value)}
              />
            </label>
            <label>
              <span style={labelStyle}>Port</span>
              <input
                type="number"
                value={(formData.port as number) || 6667}
                onChange={(e) => updateField("port", parseInt(e.target.value) || 6667)}
              />
            </label>
            <label>
              <span style={labelStyle}>Nick</span>
              <input
                value={(formData.nick as string) || ""}
                placeholder="sharkbot"
                onChange={(e) => updateField("nick", e.target.value)}
              />
            </label>
            <label>
              <span style={labelStyle}>Channels (comma-separated)</span>
              <input
                value={(formData.channels as string) || ""}
                placeholder="#general,#random"
                onChange={(e) => updateField("channels", e.target.value)}
              />
            </label>
          </>
        );

      case "msteams":
        return (
          <>
            <label>
              <span style={labelStyle}>App ID</span>
              <input
                value={(formData.appId as string) || ""}
                placeholder="Application ID"
                onChange={(e) => updateField("appId", e.target.value)}
              />
            </label>
            <label>
              <span style={labelStyle}>App Password</span>
              <input
                type="password"
                value={(formData.appPassword as string) || ""}
                placeholder="Application password"
                onChange={(e) => updateField("appPassword", e.target.value)}
              />
            </label>
            <label>
              <span style={labelStyle}>Tenant ID</span>
              <input
                value={(formData.tenantId as string) || ""}
                placeholder="Azure tenant ID"
                onChange={(e) => updateField("tenantId", e.target.value)}
              />
            </label>
          </>
        );

      case "googlechat":
        return (
          <>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={!!formData.enabled}
                onChange={(e) => updateField("enabled", e.target.checked)}
              />
              <span style={{ fontSize: 13, color: "var(--text)" }}>Enabled</span>
            </label>
            <label>
              <span style={labelStyle}>Credentials Path</span>
              <input
                value={(formData.credentialsPath as string) || ""}
                placeholder="/path/to/credentials.json"
                onChange={(e) => updateField("credentialsPath", e.target.value)}
              />
            </label>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 24 }}>Messaging Channels</h1>
      </div>

      {message && (
        <div
          style={{
            padding: "10px 16px",
            marginBottom: 16,
            borderRadius: 8,
            fontSize: 13,
            background: message.type === "success" ? "var(--green)" : "var(--red)",
            color: "#fff",
          }}
        >
          {message.text}
        </div>
      )}

      {/* Agent Selector */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <label>
          <span style={labelStyle}>Select Agent</span>
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            style={{ minWidth: 240 }}
          >
            {agents.length === 0 && <option value="">No agents available</option>}
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.status})
              </option>
            ))}
          </select>
        </label>
      </div>

      {!selectedAgentId ? (
        <p style={{ color: "var(--text-muted)" }}>Select an agent to manage its channels.</p>
      ) : (
        <>
          {/* Channel Status Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
              marginBottom: 24,
            }}
          >
            {CHANNELS.map((ch) => {
              const status = channelStatuses[ch.key];
              const statusLabel = getStatusLabel(ch.key);
              const statusColor = getStatusColor(status);
              const isActive = activeChannel === ch.key;

              return (
                <div
                  key={ch.key}
                  style={{
                    ...cardStyle,
                    borderColor: isActive ? "var(--accent)" : "var(--border)",
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                  onClick={() => openConfig(ch.key)}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{CHANNEL_ICONS[ch.key]}</span>
                      <strong style={{ fontSize: 14 }}>{ch.label}</strong>
                    </div>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: statusColor,
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: statusColor, marginBottom: 12 }}>
                    {statusLabel}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      style={{ fontSize: 11, padding: "3px 8px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openConfig(ch.key);
                      }}
                    >
                      Configure
                    </button>
                    {status && status !== "not configured" && (
                      <button
                        style={{
                          fontSize: 11,
                          padding: "3px 8px",
                          color: "var(--red)",
                          borderColor: "var(--red)",
                        }}
                        disabled={loggingOut === ch.key}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLogout(ch.key);
                        }}
                      >
                        {loggingOut === ch.key ? "Logging out..." : "Logout"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Channel Configuration Panel */}
          {activeChannel && (
            <div style={{ ...cardStyle, marginBottom: 24 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <h2 style={{ fontSize: 18, margin: 0 }}>
                  {CHANNEL_ICONS[activeChannel]}{" "}
                  {CHANNELS.find((c) => c.key === activeChannel)?.label} Configuration
                </h2>
                <button
                  onClick={() => setActiveChannel(null)}
                  style={{ fontSize: 12, padding: "4px 10px" }}
                >
                  Close
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {renderConfigForm(activeChannel)}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button className="primary" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Configuration"}
                </button>
                {channelStatuses[activeChannel] &&
                  channelStatuses[activeChannel] !== "not configured" && (
                    <button
                      style={{
                        color: "var(--red)",
                        borderColor: "var(--red)",
                      }}
                      disabled={loggingOut === activeChannel}
                      onClick={() => handleLogout(activeChannel)}
                    >
                      {loggingOut === activeChannel ? "Logging out..." : "Logout Channel"}
                    </button>
                  )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
