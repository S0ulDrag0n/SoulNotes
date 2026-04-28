import type { Metadata } from "next";
import { Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";
import { ThemeProvider } from "@/hooks/useTheme";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { NotificationToast } from "@/components/NotificationToast";
import { GamificationProvider } from "@/providers/GamificationProvider";
import { VocabularyProvider } from "@/providers/VocabularyProvider";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SoulNotes",
  description: "Language learning through conversation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <GamificationProvider>
            <VocabularyProvider>
              <NotificationProvider>
                <AppHeader />
                {children}
                <NotificationToast />
              </NotificationProvider>
            </VocabularyProvider>
          </GamificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
