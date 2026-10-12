import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "CroWeather Pro | Vrijeme u Hrvatskoj",
  description: "Aktualna mjerenja DHMZ-a diljem Hrvatske. Pronađite najbližu meteorološku postaju i pregledajte izmjerene vrijednosti.",
  applicationName: "CroWeather Pro",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="hr" suppressHydrationWarning><body><ThemeProvider attribute="class" defaultTheme="dark" enableSystem>{children}</ThemeProvider></body></html>;
}
