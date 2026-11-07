import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, MapPin, Volume2, Wifi, PlugZap, Users } from "lucide-react";
import { availabilityLabel, type RankedWorkspace, type Workspace } from "../lib/model";
import { isOutdated } from "../lib/freshness";

export const categoryImages: Record<Workspace["category"], string> = {
  Library: "/images/library.jpg", "Café": "/images/cafe.jpg", "Coworking Space": "/images/coworking.jpg", "Campus Study Area": "/images/campus.jpg", Other: "/images/community.jpg",
};

export function WorkspaceCard({ workspace, query, position }: { workspace: RankedWorkspace; query: string; position: number }) {
  const ranked = workspace.score !== null;
  return <article className="workspace-card">
    <Link href={`/workspaces/${workspace.id}${query ? `?from=${encodeURIComponent(query)}` : ""}`} className="card-link" aria-label={`View ${workspace.name}`}>
      <div className="card-image"><Image src={categoryImages[workspace.category]} alt={`Illustrative ${workspace.category.toLowerCase()} interior, not this venue`} width={800} height={450} loading={position <= 3 ? "eager" : "lazy"} />
        <span className="category-badge">{workspace.category}</span>{workspace.is_demo === 1 && <span className="demo-image-label">Demo Data · Illustrative photo</span>}
      </div>
      <div className="card-body">
        <div className="card-title-row"><h3>{workspace.name}</h3><ArrowUpRight size={19} aria-hidden="true" /></div>
        <p className="area"><MapPin size={14} />{workspace.area}</p>
        <div className="environment-grid">
          <span><Volume2 size={15} /><span>{workspace.noise_level ?? "Unknown"}<small>Noise</small></span></span>
          <span><Wifi size={15} /><span>{availabilityLabel(workspace.wifi)}<small>Wi-Fi</small></span></span>
          <span><PlugZap size={15} /><span>{availabilityLabel(workspace.outlets)}<small>Outlets</small></span></span>
          <span><Users size={15} /><span>{workspace.group_friendly === 1 ? "Group-friendly" : workspace.group_friendly === 0 ? "Not group-friendly" : "Unknown"}<small>Groups</small></span></span>
        </div>
        <div className="card-meta"><span className="cost-label">{workspace.cost_band ?? "Unknown cost"}</span><span>{workspace.is_demo === 1 ? "Verification: Unknown" : isOutdated(workspace.last_verified_date) ? "May be outdated." : `Verified: ${workspace.last_verified_date ?? "Unknown"}`}</span></div>
        {ranked && <div className="recommendation"><div className="score-row"><span className="match-label">TASK MATCH <span className="rank-number">#{position}</span></span><strong>{workspace.score}<span> / {workspace.max_score}</span></strong></div><p>{workspace.explanation}</p></div>}
      </div>
    </Link>
  </article>;
}