import Image from "next/image";

const footerLinks = [
  {
    heading: "Project",
    links: [
      { label: "GitHub", href: "https://github.com/mosnin/LoxSammy", external: true },
      { label: "Get Started", href: "#get-started" },
      { label: "How It Works", href: "#how-it-works" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Features", href: "#features" },
      { label: "Structure", href: "#structure" },
      { label: "FAQ", href: "#faq" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-black px-4 sm:px-6 pb-6 pt-12 sm:pt-16">
      <div className="mx-auto max-w-5xl w-full rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 sm:px-10 py-10 sm:py-12 backdrop-blur-sm">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          <div>
            <Image
              src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjKGZUcil50cL3l4ddD6f3aw0ebnvLr_dTXSl5LUgaMbZLIAs19H9u5TQEozHOH2M2SaRlz6GcynqLy3uF2O8pEWC5K8VDj0k19kZPGAxQ3qI0KEjRO_ql_XHAXoly_Tw7dYvja-tnddTIYtDUOkNDO7WSNBldJad3v3zEIDdt8ENoRMf1FSs63kGcjZAjr/w604-h202/Untitled%20design%20(52).png"
              alt="MODAF"
              width={120}
              height={40}
              className="h-8 w-auto mb-4"
            />
            <p className="text-sm text-white/40 max-w-[280px]">
              A reusable framework pack that helps coding agents build web
              applications with precision and speed.
            </p>
          </div>

          {footerLinks.map((group) => (
            <div key={group.heading}>
              <h3 className="text-sm font-semibold text-white mb-3">
                {group.heading}
              </h3>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      {...(link.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="text-sm text-white/40 hover:text-white transition-colors duration-150"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Disclaimer + copyright */}
        <div className="mt-10 pt-6 border-t border-white/10">
          <div className="rounded-2xl border border-yellow/20 bg-yellow/5 px-4 py-3 mb-6">
            <p className="text-xs text-yellow font-medium">
              ⚠ Experimental Software Disclaimer
            </p>
            <p className="text-xs text-white/50 mt-1">
              MODAF is experimental and provided as-is. Using this framework may
              result in unexpected changes to your repository, including
              potential data loss or complete destruction of your codebase.
              Always back up your work and use version control. Use at your own
              risk.
            </p>
          </div>
          <p className="text-xs text-white/30 text-center">
            &copy; {new Date().getFullYear()} MODAF. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
