import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/toast-provider";

export const metadata: Metadata = {
  title: "SharkSwarm",
  description: "Multi-agent orchestration platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{ baseTheme: dark }}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/sign-in"
    >
      <html lang="en" suppressHydrationWarning>
        <body>
          <ThemeProvider>{children}</ThemeProvider>
          <ToastProvider />
        </body>
      </html>
    </ClerkProvider>
  );
}
