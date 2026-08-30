import type { Metadata } from "next";
import { Familjen_Grotesk, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

const familjen = Familjen_Grotesk({
  variable: "--font-familjen",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

/** The study layout under `/s/[studyId]` replaces this with the study title. */
export const metadata: Metadata = {
  title: "Soundings",
  description: "Screening survey and voice interview",
};

/**
 * Applies the stored theme before the first paint. A dark-mode user does not
 * see a flash of the light palette. When there is no stored choice, the
 * script sets nothing and CSS applies the OS preference.
 */
const themeInit = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${familjen.variable} ${instrument.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
