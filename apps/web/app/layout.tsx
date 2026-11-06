import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
const font = localFont({
  src: "../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",
  display: "swap",
  variable: "--font-manrope",
});
export const metadata: Metadata = {
  title: "FlowDesk — Business operations workspace",
  description:
    "Independent demo project. A connected workspace for clients, projects and team tasks.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={font.variable}>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
