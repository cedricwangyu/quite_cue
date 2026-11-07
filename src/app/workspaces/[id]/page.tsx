import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Volume2, Wifi, PlugZap, Users, Clock, Banknote, AlertCircle, ExternalLink } from "lucide-react";
import { getWorkspace } from "../../../server/catalog";
import { parseFilters, parseId, InputError } from "../../../lib/input";
import { availabilityLabel, type Workspace } from "../../../lib/model";
import { isOutdated } from "../../../lib/freshness";
import { categoryImages } from "../../../components/workspace-card";
import { Retry } from "../../../components/retry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function WorkspaceDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const { id } = await params;
  let back = "/";
  const from = (await searchParams).from;
  if (typeof from === "string") { try { parseFilters(new URLSearchParams(from)); back = `/?${new URLSearchParams(from)}`; } catch {} }
  let workspace: Workspace | null = null;
  let failed = false;
  try { workspace = getWorkspace(parseId(id)); } catch (error) { if (!(error instanceof InputError)) failed = true; }
  if (failed) return <main id="main" className="main-shell"><Link className="back-link" href={back}><ArrowLeft size={17} />Back to results</Link><div className="state-panel" role="alert"><AlertCircle size={30} /><h1>Results temporarily unavailable.</h1><Retry /></div></main>;
  if (!workspace) notFound();
  const fields = [
    { label: "Noise level", value: workspace.noise_level ?? "Unknown", Icon: Volume2 },
    { label: "Wi-Fi", value: availabilityLabel(workspace.wifi), Icon: Wifi },
    { label: "Power outlets", value: availabilityLabel(workspace.outlets), Icon: PlugZap },
    { label: "Group-friendly", value: workspace.group_friendly === 1 ? "Yes" : workspace.group_friendly === 0 ? "No" : "Unknown", Icon: Users },
    { label: "Cost category", value: workspace.cost_band ?? "Unknown", Icon: Banknote },
    { label: "Opening hours", value: workspace.opening_hours ?? "Unknown", Icon: Clock },
  ];
  let sourceUrl: string | null = null;
  if (workspace.source_url) { try { const url = new URL(workspace.source_url); if (["https:", "http:"].includes(url.protocol)) sourceUrl = url.href; } catch {} }
  return <main id="main" className="main-shell detail-shell">
    <Link className="back-link" href={back}><ArrowLeft size={17} />Back to results</Link>
    <div className="detail-heading"><div><p className="eyebrow">{workspace.category}</p><h1>{workspace.name}</h1><p className="area"><MapPin size={17} />{workspace.area}</p></div>{workspace.is_demo === 1 && <span className="detail-demo">Demo Data</span>}</div>
    <figure className="detail-image"><Image src={categoryImages[workspace.category]} alt={`Illustrative ${workspace.category.toLowerCase()} interior; not a photograph of ${workspace.name}`} width={1400} height={700} priority /><figcaption>Illustrative photo, not this venue.</figcaption></figure>
    <div className="detail-columns"><div><section className="detail-section"><h2>About this space</h2><p>{workspace.description ?? "Unknown"}</p><dl className="location-list"><div><dt>Address</dt><dd>{workspace.address || "Unknown"}</dd></div><div><dt>Area</dt><dd>{workspace.area || "Unknown"}</dd></div><div><dt>Category</dt><dd>{workspace.category}</dd></div></dl></section>
    <section className="detail-section"><h2>Environment & amenities</h2><dl className="detail-amenities">{fields.map(({ label, value, Icon }) => <div key={label}><dt><Icon size={19} />{label}</dt><dd>{value}</dd></div>)}</dl></section></div>
    <aside className="provenance"><h2>Data & sources</h2>{workspace.is_demo === 1 && <p className="source-disclaimer">Fictional Demo Data. No real-world collection or verification is claimed.</p>}
      <dl>{[["Collection method", workspace.collection_method], ["Source note", workspace.source_note], ["Observation reference", workspace.observation_ref], ["Last verified date", workspace.last_verified_date]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "Unknown"}</dd></div>)}<div><dt>Source URL</dt><dd>{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer">View source <ExternalLink size={14} /></a> : "Unknown"}</dd></div></dl>
      {isOutdated(workspace.last_verified_date) && <p className="stale-warning"><AlertCircle size={16} />May be outdated.</p>}<p className="source-footnote">Environment attributes describe collected observations, not real-time conditions.</p>
    </aside></div>
  </main>;
}