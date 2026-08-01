'use client';

import Link from 'next/link';

export default function ReleaseGatePage() {
  return (
    <main className="min-h-screen bg-black text-white p-6 font-sans">
      <header className="max-w-4xl mx-auto mb-12 text-center">
        <div className="flex justify-center items-center gap-3 mb-4">
          <Link href="/" className="text-zinc-500 hover:text-white transition-colors absolute left-8 top-8">← Back</Link>
          <span className="bg-green-500/20 text-green-500 text-xs font-black px-3 py-1.5 rounded border border-green-500/30 uppercase tracking-widest">Manufacturing Release Gate</span>
        </div>
        <h1 className="text-4xl font-black tracking-tight mb-2">Release to Factory: v2.4.1</h1>
        <p className="text-gray-400">Cryptographically bound evidence receipts and domain reviews for PCBA-002.</p>
      </header>

      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Step 1: Constraint Validation */}
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center text-blue-500 font-bold">1</div>
            <h2 className="text-xl font-bold">Executable Constraints</h2>
            <span className="ml-auto bg-green-500/20 text-green-500 text-xs font-bold px-2 py-1 rounded">ALL PASS</span>
          </div>
          <div className="ml-14 grid grid-cols-2 gap-4">
            <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex justify-between items-center text-sm">
              <span className="text-zinc-400">Thermal Envelope</span>
              <span className="text-green-400 font-mono">PASS</span>
            </div>
            <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex justify-between items-center text-sm">
              <span className="text-zinc-400">Electrical Tolerance</span>
              <span className="text-green-400 font-mono">PASS</span>
            </div>
            <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex justify-between items-center text-sm">
              <span className="text-zinc-400">Firmware Resource</span>
              <span className="text-green-400 font-mono">PASS</span>
            </div>
            <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex justify-between items-center text-sm">
              <span className="text-zinc-400">BOM Availability</span>
              <span className="text-green-400 font-mono">PASS</span>
            </div>
          </div>
        </div>

        {/* Step 2: Physical CI Evidence */}
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center text-blue-500 font-bold">2</div>
            <h2 className="text-xl font-bold">Physical-CI Evidence Receipts</h2>
            <span className="ml-auto bg-green-500/20 text-green-500 text-xs font-bold px-2 py-1 rounded">VERIFIED</span>
          </div>
          <div className="ml-14 space-y-3 text-sm">
            <div className="flex justify-between items-center p-3 border border-white/5 bg-black/40 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-green-400">✓</span>
                <span className="text-zinc-300 font-medium">Thermal Chamber Burn-in</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-zinc-500 font-mono">Operator: JD-042</span>
                <a href="#" className="text-blue-400 hover:underline">View Raw Data ↗</a>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 border border-white/5 bg-black/40 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-green-400">✓</span>
                <span className="text-zinc-300 font-medium">EMI/EMC Pre-compliance</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-zinc-500 font-mono">Fixture: FX-09</span>
                <a href="#" className="text-blue-400 hover:underline">View Raw Data ↗</a>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Domain Signatures */}
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center text-blue-500 font-bold">3</div>
            <h2 className="text-xl font-bold">Domain Signatures</h2>
            <span className="ml-auto bg-green-500/20 text-green-500 text-xs font-bold px-2 py-1 rounded">3/3 SIGNED</span>
          </div>
          <div className="ml-14 flex gap-4">
            <div className="flex-1 bg-black/40 border border-green-500/30 rounded-xl p-4 text-center">
              <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Electrical Lead</div>
              <div className="font-mono text-green-400 text-xs mb-2">0x4F92...B31A</div>
              <div className="text-sm font-bold">Sarah Connor</div>
            </div>
            <div className="flex-1 bg-black/40 border border-green-500/30 rounded-xl p-4 text-center">
              <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Mechanical Lead</div>
              <div className="font-mono text-green-400 text-xs mb-2">0x992A...F012</div>
              <div className="text-sm font-bold">David Bowman</div>
            </div>
            <div className="flex-1 bg-black/40 border border-green-500/30 rounded-xl p-4 text-center">
              <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Firmware Lead</div>
              <div className="font-mono text-green-400 text-xs mb-2">0x1A2B...3C4D</div>
              <div className="text-sm font-bold">Ellen Ripley</div>
            </div>
          </div>
        </div>

        {/* Release Button */}
        <div className="pt-8 pb-12 flex justify-center">
          <button className="bg-green-500 hover:bg-green-400 text-black font-black text-xl px-12 py-5 rounded-2xl transition-all shadow-[0_0_40px_rgba(34,197,94,0.4)] flex items-center gap-3 hover:scale-105">
            <span>🚀</span> Sign & Release to Factory
          </button>
        </div>

      </div>
    </main>
  );
}
