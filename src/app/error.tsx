"use client";
import { RotateCcw, AlertCircle } from "lucide-react";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="main" className="main-shell"><div className="state-panel" role="alert"><AlertCircle size={30} /><h1>Results temporarily unavailable.</h1><button className="primary-button" onClick={reset}><RotateCcw size={16} />Retry</button></div></main>;
}