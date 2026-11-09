import React from 'react';
import { ShieldAlert, ArrowRight, Construction } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StagedModulePlaceholder({
  phaseNumber,
  moduleTitle,
  icon: Icon,
  description,
  plannedFeatures = [],
}) {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-8 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-[#0b0f17] via-[#101623] to-[#0b0f17] shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 text-xs font-mono">
            <ShieldAlert className="w-3.5 h-3.5" />
            Phase {phaseNumber} Module Implementation Ready
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <Icon className="w-8 h-8 text-cyan-400" />
            {moduleTitle}
          </h1>
          <p className="text-sm text-slate-400 font-mono leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      {/* Planned Feature Checklist Card */}
      <div className="p-6 rounded-2xl border border-[#151d2f] bg-[#0b0f17] space-y-4">
        <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider text-slate-300">
          Module Capabilities & Architecture Specs
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
          {plannedFeatures.map((feat, i) => (
            <div key={i} className="p-3.5 rounded-xl border border-[#1f2a42] bg-[#07090e] flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
              <span className="text-slate-300">{feat}</span>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-[#151d2f] flex items-center justify-between">
          <span className="text-xs font-mono text-slate-500">
            Will be activated in Phase {phaseNumber} of the roadmap.
          </span>
          <Link
            to="/dashboard"
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5"
          >
            Back to Dashboard <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

