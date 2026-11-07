import type { Metadata } from "next";
import Link from "next/link";
import { AudioLines, ArrowUpRight } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = { title: "Quiet Cue | Find Your Focus", description: "Task-based discovery of study and workspaces. Group 6 course MVP with clearly labeled demo data." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="header"><div className="header-inner">
      <Link href="/" className="brand" aria-label="Quiet Cue home"><span className="brand-icon"><AudioLines size={23} /></span>Quiet Cue<span className="version">V0.1</span></Link>
      <div className="header-right"><span className="project-label">GROUP 6 / WORKSPACE DISCOVERY</span><Link className="catalog-link" href="/">Explore spaces <ArrowUpRight size={16} /></Link></div>
    </div></header>
    {children}
    <footer className="footer"><span>Quiet Cue · Software Engineering Group 6</span><span>Collected information, not live noise or occupancy.</span></footer>
  </body></html>;
}