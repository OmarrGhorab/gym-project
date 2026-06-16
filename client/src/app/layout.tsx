import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ATP Gym Client",
  description: "Localized admin client for ATP Gym",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
