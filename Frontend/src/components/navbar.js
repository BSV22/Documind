"use client";

import React from 'react';

const Navbar = ({ onToggleSidebar, sidebarOpen }) => {
    return (
        <div className="fixed top-0 left-0 z-50 w-full px-3 py-3 sm:px-5">
            <nav className="mx-auto max-w-[1700px] rounded-[28px] border border-white/10 bg-slate-900/75 px-4 py-3 shadow-[0_30px_80px_rgba(15,23,42,0.55)] backdrop-blur-xl sm:px-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-lg font-black text-slate-950 shadow-lg shadow-cyan-500/30">
                                D
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-[0.35em] text-cyan-300">AI Workspace</p>
                                <h1 className="text-xl font-bold tracking-tight text-white">Documind</h1>
                            </div>
                        </div>

                        <button
                            onClick={onToggleSidebar}
                            className="rounded-2xl border border-cyan-400/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold tracking-[0.14em] text-cyan-200 transition-all duration-200 hover:bg-cyan-400 hover:text-slate-950 cursor-pointer sm:text-sm"
                        >
                            {sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
                        </button>
                    </div>

                    <ul className="flex items-center gap-4 text-sm text-slate-200 sm:gap-8">
                        <li className="transition hover:text-white">
                            <a href="https://github.com/Documind-ACA-Summer-Project-2026" target="_blank" rel="noreferrer" className="text-slate-200 hover:text-white">
                                About
                            </a>
                        </li>
                        <li className="transition hover:text-white">
                            <a href="https://github.com/orgs/Documind-ACA-Summer-Project-2026/people" target="_blank" rel="noreferrer" className="text-slate-200 hover:text-white">
                                Contact
                            </a>
                        </li>
                    </ul>
                </div>
            </nav>
        </div>
    );
};

export default Navbar;
