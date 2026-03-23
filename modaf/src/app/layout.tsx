import type { Metadata } from "next";
import { FloatingPlayer } from "@/components/ui/floating-player";
import { SmoothScroll } from "@/components/ui/smooth-scroll";
import "./globals.css";

export const metadata: Metadata = {
  title: "MODAF | Build web applications faster with AI agents",
  description:
    "A reusable framework that helps coding agents like Claude Code architect and build web applications with precision. Clone, describe your idea, and let MODAF handle the rest.",
  openGraph: {
    title: "MODAF | Build web applications faster with AI agents",
    description:
      "A reusable framework that helps coding agents like Claude Code architect and build web applications with precision.",
    type: "website",
    images: [
      {
        url: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjnSJii3lYmYktc-pUCxwKm09ilng6VRSsQdQTpOzuljzlsYE2cVyzhhQUO_KfyDvHS21IOX1EGgqdeFDceSOVaHQnC3-G69vDAQwDJZe1mnGNC0YNs9hjsv94xqY7eRqhxBtEVLdn6KaAXqhenqJJece2xjmuEfaxYvJXm7sK3aNZlyr1m0m9uXDvZjx0K/w606-h318/YOU%20GOT%20THAT%20MODAF.png",
        width: 606,
        height: 318,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MODAF | Build web applications faster with AI agents",
    description:
      "A reusable framework that helps coding agents like Claude Code architect and build web applications with precision.",
    images: [
      "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjnSJii3lYmYktc-pUCxwKm09ilng6VRSsQdQTpOzuljzlsYE2cVyzhhQUO_KfyDvHS21IOX1EGgqdeFDceSOVaHQnC3-G69vDAQwDJZe1mnGNC0YNs9hjsv94xqY7eRqhxBtEVLdn6KaAXqhenqJJece2xjmuEfaxYvJXm7sK3aNZlyr1m0m9uXDvZjx0K/w606-h318/YOU%20GOT%20THAT%20MODAF.png",
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      </head>
      <body className="min-h-full flex flex-col bg-black text-white font-sans">
        <SmoothScroll />
        {children}
        <FloatingPlayer />
      </body>
    </html>
  );
}
