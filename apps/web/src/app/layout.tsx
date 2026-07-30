import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LogicHub",
    template: "%s | LogicHub",
  },
  description:
    "Design hardware virtually and see what your configuration can become. The engine "
    + "runs in your browser; your design stays on your device.",
  applicationName: "LogicHub",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

// themeColor belongs on the viewport export in this version, not on metadata.
export const viewport: Viewport = {
  themeColor: "#07110f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
