"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const onboardingSteps = [
  {
    image: "/images/welcome_slide_1.jpg",
    title: "Property Rates, Simplified.",
    description:
      "View valuations, assess tax rates, and manage all your municipal properties in one place.",
  },
  {
    image: "/images/welcome_slide_2.jpg",
    title: "Official Digital Proof.",
    description:
      "Pay with one tap and receive tamper-proof, downloadable digital receipts valid offline.",
  },
  {
    image: "/images/welcome_slide_3.jpg",
    title: "Bank-Grade Security.",
    description:
      "Protected by end-to-end encryption protocols and real-time municipal database synchronization.",
  },
];

export default function WelcomePage() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % onboardingSteps.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const active = onboardingSteps[currentStep];

  return (
    <section className="relative w-full h-full min-h-screen flex flex-col justify-between p-6 sm:p-8 pt-24 pb-8 overflow-hidden">
      {/* 1. Full-Screen Background Image Carousel */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-slate-950">
        <AnimatePresence mode="popLayout">
          <motion.img
            key={active.image}
            src={active.image}
            alt=""
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full object-cover object-center"
            aria-hidden="true"
          />
        </AnimatePresence>

        {/* Multi-layer Cinematic Vignette & Gradient Overlay for Maximum Legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/40" />
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
      </div>

      {/* 2. Middle / Bottom Dynamic Content Section */}
      <div className="relative z-10 space-y-6 mt-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4 }}
            className="space-y-2.5 text-center sm:text-left"
          >
            {/* Title */}
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight drop-shadow-md">
              {active.title}
            </h1>

            {/* Description */}
            <p className="text-slate-200 text-sm sm:text-base leading-relaxed drop-shadow-sm font-medium">
              {active.description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* 3. Centered Carousel Indicator Dots */}
        <nav aria-label="Carousel navigation" className="flex items-center justify-center gap-2.5 py-1">
          {onboardingSteps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                index === currentStep
                  ? "w-8 bg-surface shadow-md"
                  : "w-2 bg-surface/40 hover:bg-surface/60"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </nav>

        {/* 4. Bottom Action Area */}
        <footer className="space-y-3.5 pt-2">
          <Link
            href="/auth/login"
            className="btn-3d-secondary w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2 group cursor-pointer"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>

          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-300 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Encrypted with End-to-End Municipal Protocols</span>
          </div>
        </footer>
      </div>
    </section>
  );
}
