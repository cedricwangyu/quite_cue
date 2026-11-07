import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";

export default function NotFound() {
  return <main id="main" className="main-shell"><div className="state-panel"><MapPin size={32} /><h1>Workspace not found.</h1><p>This space does not exist or is not publicly available.</p><Link className="primary-button" href="/"><ArrowLeft size={16} />Back to workspaces</Link></div></main>;
}