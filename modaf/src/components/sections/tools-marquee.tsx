import Image from "next/image";
import { Marquee } from "@/components/ui/marquee";

const tools = [
  {
    name: "Cursor",
    src: "https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/dark/cursor.png",
  },
  {
    name: "Claude",
    src: "https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/dark/claude-color.png",
  },
  {
    name: "Codex",
    src: "https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/dark/codex-color.png",
  },
  {
    name: "Windsurf",
    src: "https://cdn.toolcentral.ai/2025/11/Windsurf-logo.png",
  },
  {
    name: "OpenClaw",
    src: "https://zyugzloemocjcxmspsso.supabase.co/storage/v1/object/public/static-assets/openclaw-logo.png",
  },
  {
    name: "Kimi",
    src: "https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/dark/kimi-color.png",
  },
  {
    name: "Jules",
    src: "https://static.wikia.nocookie.net/logopedia/images/4/4a/Google_Antigravity_icon.svg/revision/latest/scale-to-width-down/1200?cb=20251119202403",
  },
  {
    name: "Replit",
    src: "https://images.seeklogo.com/logo-png/45/2/replit-icon-logo-png_seeklogo-453824.png",
  },
  {
    name: "NanoClaw",
    src: "https://nanoclaws.io/images/nanoclaw.png",
  },
  {
    name: "Tonkotsu",
    src: "https://www.tonkotsu.ai/logo_ring.png",
  },
  {
    name: "Augment",
    src: "https://s3.amazonaws.com/beamstart/2025/Sep/13/0f45a619cfcff4773d9ed334131644f2.jpeg",
  },
  {
    name: "Gemini",
    src: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTysfvFgHMVChk-7glLKWvdIJLLoA2aau0m1g&s",
  },
  {
    name: "Cline",
    src: "https://pbs.twimg.com/profile_images/2023711713888215040/rX3tGO1T.png",
  },
  {
    name: "Qwen",
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Qwen_logo.svg/3840px-Qwen_logo.svg.png",
  },
];

function ToolLogo({ name, src }: { name: string; src: string }) {
  return (
    <div className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border border-white/10 bg-white/[0.03] flex-shrink-0">
      <Image
        src={src}
        alt={name}
        width={48}
        height={48}
        className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
      />
    </div>
  );
}

export function ToolsMarquee() {
  return (
    <section className="py-8 sm:py-16 overflow-hidden">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/30 text-center mb-8">
        Use with your favorite coding tools
      </p>
      <Marquee>
        {tools.map((tool) => (
          <ToolLogo key={tool.name} {...tool} />
        ))}
      </Marquee>
    </section>
  );
}
