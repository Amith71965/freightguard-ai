import type { Metadata } from "next";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/600.css";
import "@fontsource/source-sans-3/700.css";
import "@fontsource/roboto-condensed/600.css";
import "@fontsource/roboto-condensed/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "FreightGuard AI — Exception Control",
  description: "A Retell-powered logistics exception desk.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
