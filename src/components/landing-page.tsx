"use client";

import { useState } from "react";
import { ArrowRight, Box, Lock } from "lucide-react";

interface LandingPageProps {
    onStart: () => void;
    onAdminLogin: () => void;
}

export function LandingPage({ onStart, onAdminLogin }: LandingPageProps) {
    const [adminClickCount, setAdminClickCount] = useState(0);

    const handleLogoClick = () => {
        // Hidden mechanism: 5 clicks to show admin login button
        const newCount = adminClickCount + 1;
        setAdminClickCount(newCount);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,0,0.05),transparent_70%)]" />

            {/* Hero Content */}
            <div className="z-10 text-center space-y-8 max-w-4xl px-4">
                <div
                    onClick={handleLogoClick}
                    className="cursor-default select-none transition-transform hover:scale-105 active:scale-95 duration-500"
                >
                    <h1 className="text-7xl md:text-9xl font-black tracking-tighter uppercase mb-2 text-white">
                        Design<span className="text-[var(--accent-yellow)]">Haus</span>
                    </h1>
                    <p className="text-sm md:text-base tracking-[0.5em] text-gray-400 uppercase font-medium">
                        AI-Powered Industrial Packaging
                    </p>
                </div>

                <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto font-light leading-relaxed">
                    The future of product design is automated. Collaborate with our advanced AI to generate production-ready packaging in seconds.
                </p>

                <div className="pt-8">
                    <button
                        onClick={onStart}
                        className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-black bg-[var(--accent-yellow)] overflow-hidden transition-all duration-300 hover:bg-white focus:outline-none ring-offset-2 focus:ring-2 ring-[var(--accent-yellow)]"
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            START PROJECT <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </span>
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    </button>
                </div>
            </div>

            {/* Hidden Admin Access */}
            {(adminClickCount >= 5) && (
                <button
                    onClick={onAdminLogin}
                    className="absolute bottom-8 right-8 text-gray-800 hover:text-white transition-colors flex items-center gap-2 text-xs uppercase tracking-widest"
                >
                    <Lock className="w-3 h-3" /> Admin Access
                </button>
            )}

            {/* Decorative 3D-ish Elements */}
            <div className="absolute top-1/4 left-10 w-24 h-24 border border-white/10 rounded-full animate-float opacity-50 block blur-sm" />
            <div className="absolute bottom-1/4 right-10 w-32 h-32 border border-[var(--accent-yellow)]/20 rounded-full animate-float-delayed opacity-50 block blur-sm" />
        </div>
    );
}
