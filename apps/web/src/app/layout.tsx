import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_ORIGIN = "https://logichub.app";

const DESCRIPTION =
  "Design hardware virtually and see what your configuration can become. The engine "
  + "runs in your browser; your design stays on your device.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "LogicHub",
    template: "%s | LogicHub",
  },
  description: DESCRIPTION,
  applicationName: "LogicHub",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    type: "website",
    siteName: "LogicHub",
    title: "LogicHub",
    description: DESCRIPTION,
    url: SITE_ORIGIN,
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LogicHub",
    description: DESCRIPTION,
    images: ["/og-image.png"],
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
