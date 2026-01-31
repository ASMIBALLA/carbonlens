"use client";

import React from "react";

const HOTSPOTS = [
    {
        id: "t-nagar",
        name: "T Nagar",
        desc: "Retail + peak-hour choke points",
        speed: 28,
        freeflow: 42,
        confidence: 89,
        status: "OK",
        impact: "High Retail Activity"
    },
    {
        id: "guindy",
        name: "Guindy",
        desc: "GST corridor + industrial traffic",
        speed: 19,
        freeflow: 50,
        confidence: 94,
        status: "Heavy",
        impact: "Industrial Shift Change"
    },
    {
        id: "adyar",
        name: "Adyar",
        desc: "Bridge + school zones",
        speed: 24,
        freeflow: 45,
        confidence: 82,
        status: "OK",
        impact: "School Zone Slowdown"
    },
    {
        id: "velachery",
        name: "Velachery",
        desc: "IT commute + mall traffic",
        speed: 28,
        freeflow: 48,
        confidence: 91,
        status: "OK",
        impact: "IT Pulse Active"
    },
    {
        id: "anna-nagar",
        name: "Anna Nagar",
        desc: "Residential arterials",
        speed: 28,
        freeflow: 40,
        confidence: 87,
        status: "OK",
        impact: "Steady Flow"
    },
    {
        id: "egmore",
        name: "Egmore",
        desc: "Central junctions",
        speed: 21,
        freeflow: 45,
        confidence: 84,
        status: "OK",
        impact: "Transit Hub Congestion"
    },
    {
        id: "mylapore",
        name: "Mylapore",
        desc: "Dense inner streets",
        speed: 32,
        freeflow: 38,
        confidence: 96,
        status: "OK",
        impact: "Local Flow Optimal"
    },
    {
        id: "porur",
        name: "Porur",
        desc: "Ring-road spillover",
        speed: 21,
        freeflow: 55,
        confidence: 83,
        status: "OK",
        impact: "Truck Movement Heavy"
    }
];

export default function ChennaiHotspots() {
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const currentTime = isMounted
        ? new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        })
        : "--:--:--";

    return (
        <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">Chennai Hotspot Metrics</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Live • {currentTime}</span>
                    </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-slate-800/50 border border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Network Status: Operational
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {HOTSPOTS.map((h) => {
                    const ratio = h.speed / h.freeflow;
                    const isCongested = ratio < 0.6;

                    return (
                        <div
                            key={h.id}
                            className="group relative overflow-hidden rounded-xl border border-white/10 bg-slate-900/40 backdrop-blur-md p-5 transition-all hover:border-emerald-500/30 hover:bg-slate-900/60 shadow-xl"
                        >
                            {/* Card Header */}
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors uppercase tracking-tight">{h.name}</h3>
                                    <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">{h.desc}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border ${isCongested ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                    }`}>
                                    {isCongested ? "Heavy" : "OK"}
                                </span>
                            </div>

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="space-y-1">
                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Speed</div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-xl font-black text-white">{h.speed}</span>
                                        <span className="text-[10px] text-slate-500 font-bold">km/h</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Freeflow</div>
                                    <div className="flex items-baseline gap-1 focus:opacity-100 opacity-60">
                                        <span className="text-sm font-bold text-slate-300">{h.freeflow}</span>
                                        <span className="text-[9px] text-slate-500 font-bold">km/h</span>
                                    </div>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full h-1 bg-slate-800 rounded-full mb-4 overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-1000 ${ratio > 0.8 ? 'bg-emerald-500' : ratio > 0.5 ? 'bg-amber-500' : 'bg-red-500'
                                        }`}
                                    style={{ width: `${(h.speed / h.freeflow) * 100}%` }}
                                />
                            </div>

                            {/* Card Footer */}
                            <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-bold text-slate-500 uppercase">Confidence</span>
                                    <span className="text-[11px] font-black text-emerald-400">{h.confidence}%</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[8px] font-bold text-slate-500 uppercase block">Impact</span>
                                    <span className="text-[9px] text-slate-300 font-bold italic">{h.impact}</span>
                                </div>
                            </div>

                            {/* Decorative accent */}
                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-30 transition-opacity">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
