"use client";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

export function Retry() {
  const router = useRouter();
  return <button className="primary-button" onClick={() => router.refresh()}><RotateCcw size={16} />Retry</button>;
}