"use client";

import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, BookOpen, Users, Laptop, RotateCcw, ArrowRight, AlertCircle, X, Wifi, PlugZap } from "lucide-react";
import { categories, noiseLevels, costBands, tasks, type RankedWorkspace } from "../lib/model";
import { WorkspaceCard } from "./workspace-card";

const taskIcons = [BookOpen, Users, Laptop];

export function Catalog({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [response, setResponse] = useState<{ key: string; workspaces: RankedWorkspace[]; error: string | null }>({ key: "", workspaces: [], error: null });
  const [attempt, setAttempt] = useState(0);
  const params = new URLSearchParams(query);
  const key = `${query}|${attempt}`;
  const loading = response.key !== key;

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await fetch(`/api/workspaces${query ? `?${query}` : ""}`, { signal: controller.signal });
        const data = await result.json();
        if (!result.ok) throw new Error(result.status === 400 ? data.error : "Results temporarily unavailable.");
        if (!controller.signal.aborted) setResponse({ key, workspaces: data.workspaces, error: null });
      } catch (error) {
        if (!controller.signal.aborted) setResponse({ key, workspaces: [], error: error instanceof Error && error.message.startsWith("Invalid") || error instanceof Error && error.message.startsWith("Search") ? error.message : "Results temporarily unavailable." });
      }
    }, 180);
    window.history.replaceState(null, "", query ? `/?${query}` : "/");
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, key]);

  function update(name: string, value: string) {
    const next = new URLSearchParams(query);
    if (value) next.set(name, value); else next.delete(name);
    setQuery(next.toString());
  }
  const selectedTask = params.get("task");
  const filteredCount = [...params.keys()].filter(name => name !== "task").length;
  return <main id="main" className="main-shell">
    <section className="intro"><div><p className="eyebrow">A SPACE FOR WHAT COMES NEXT</p><h1>Find your place to focus.</h1><p className="intro-copy">Study quietly, think together, or settle into work.</p></div><div className="demo-notice"><span className="status-dot" /><div><strong>Demo Data</strong><p>Fictional venues. Sources and verification dates are unknown.</p></div></div></section>
    <section className="search-section" aria-label="Search and task selection">
      <form className="search-form" onSubmit={event => event.preventDefault()}><Search size={21} aria-hidden="true" /><label className="sr-only" htmlFor="search">Search workspace name or area</label><input id="search" type="search" maxLength={100} value={params.get("search") ?? ""} onChange={event => update("search", event.target.value)} placeholder="Search workspace name or area" /><span className="search-limit">100 max</span></form>
      <div className="task-section"><span className="field-label" id="task-label">What are you working on?</span><div className="task-options" role="group" aria-labelledby="task-label">
        {tasks.map((task, index) => { const Icon = taskIcons[index]; return <button key={task} className={`task-button ${selectedTask === task ? "selected" : ""}`} aria-pressed={selectedTask === task} onClick={() => update("task", selectedTask === task ? "" : task)}><Icon size={18} />{task}</button>; })}
      </div></div>
    </section>
    <div className="discovery-layout">
      <aside className="filters" aria-label="Environment filters"><div className="filter-heading"><h2><SlidersHorizontal size={17} />Filters{filteredCount > 0 && <span className="filter-count">{filteredCount}</span>}</h2><button className="icon-button" title="Clear All Filters" aria-label="Clear All Filters" onClick={() => setQuery("")}><RotateCcw size={16} /></button></div>
        <div className="select-field"><label htmlFor="category">Workspace category</label><select id="category" value={params.get("category") ?? ""} onChange={event => update("category", event.target.value)}><option value="">All categories</option>{categories.map(category => <option key={category}>{category}</option>)}</select></div>
        <div className="select-field"><label htmlFor="noise">Noise level</label><select id="noise" value={params.get("noise") ?? ""} onChange={event => update("noise", event.target.value)}><option value="">Any noise level</option>{noiseLevels.map(noise => <option key={noise}>{noise}</option>)}</select></div>
        <fieldset className="amenities"><legend>Amenities</legend>{[["wifi", "Wi-Fi Available", Wifi], ["outlets", "Power Outlets Available", PlugZap], ["group", "Group-Friendly", Users]].map(([name, label, Icon]) => { const AmenityIcon = Icon as typeof Wifi; return <label key={name as string}><input type="checkbox" checked={params.get(name as string) === "true"} onChange={event => update(name as string, event.target.checked ? "true" : "")} /><AmenityIcon size={16} /><span>{label as string}</span></label>; })}</fieldset>
        <div className="select-field"><label htmlFor="cost">Cost</label><select id="cost" value={params.get("cost") ?? ""} onChange={event => update("cost", event.target.value)}><option value="">Any cost</option>{costBands.map(cost => <option key={cost}>{cost}</option>)}</select></div>
        <div className="filter-note"><BookOpen size={19} /><p>Environment information is manually collected. Unknown amenities are not counted as available.</p></div>
      </aside>
      <section className="results" aria-labelledby="results-heading" aria-busy={loading}>
        <div className="results-heading"><div><h2 id="results-heading">{selectedTask ? "Your task matches" : "Explore workspaces"}</h2><p aria-live="polite">{loading ? "Finding workspaces…" : response.error ? "Unable to load results" : `${response.workspaces.length} spaces${selectedTask ? ` · Ranked for ${selectedTask}` : " · All public spaces"}`}</p></div><span className="results-mark">{selectedTask ? "BEST MATCH FIRST" : "A–Z"}</span></div>
        {filteredCount > 0 && <div className="active-filters">{[...params.entries()].filter(([name]) => name !== "task").map(([name, value]) => <button key={name} onClick={() => update(name, "")} aria-label={`Remove ${name} filter`}><span>{name === "search" ? `“${value}”` : ["wifi", "outlets", "group"].includes(name) ? name === "wifi" ? "Wi-Fi" : name === "outlets" ? "Power outlets" : "Group-friendly" : value}</span><X size={13} /></button>)}</div>}
        {loading ? <div className="card-grid" role="status" aria-label="Loading workspaces">{[0, 1, 2, 3].map(number => <div className="skeleton-card" key={number}><div /><span /><span /></div>)}</div> : response.error ? <div className="state-panel" role="alert"><AlertCircle size={30} /><h3>{response.error}</h3><div className="state-actions"><button className="primary-button" onClick={() => setAttempt(attempt + 1)}><RotateCcw size={16} />Retry</button><button className="text-button" onClick={() => setQuery("")}>Clear All Filters</button></div></div> : response.workspaces.length === 0 ? <div className="state-panel"><Search size={30} /><h3>No workspaces match your search.</h3><button className="primary-button" onClick={() => setQuery("")}>Clear All Filters<ArrowRight size={16} /></button></div> : <div className="card-grid">{response.workspaces.map((workspace, index) => <WorkspaceCard key={workspace.id} workspace={workspace} query={query} position={index + 1} />)}</div>}
      </section>
    </div>
  </main>;
}