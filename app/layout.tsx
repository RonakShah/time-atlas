import type { Metadata } from "next";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/fraunces/latin-500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Time Atlas — See history side by side",
  description: "Build a timeline of people, periods, and events and see how they overlap.",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
