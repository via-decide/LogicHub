'use client';

export default function SemanticDiffPage() {
  return (
    <main className="min-h-screen bg-black text-white p-6 font-sans">
      <header className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <a href="/" className="text-zinc-500 hover:text-white transition-colors">← Back</a>
          <span className="bg-amber-500/20 text-amber-500 text-xs font-black px-2 py-1 rounded border border-amber-500/30 uppercase tracking-widest">Semantic Diff</span>
        </div>
        <h1 className="text-4xl font-black tracking-tight mb-2">Component Swap: LDO Regulator</h1>
        <p className="text-gray-400">Comparing PR #142 across physical domains against the Canonical Object Graph.</p>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Traditional Git Text Diff */}
        <div className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden flex flex-col">
          <div className="bg-zinc-800/50 p-4 border-b border-white/10 flex justify-between items-center">
            <h2 className="font-bold text-sm text-zinc-300">GitHub Text Diff</h2>
            <span className="text-xs text-zinc-500 font-mono">hardware/pcb/bom.csv</span>
          </div>
          <div className="p-4 font-mono text-sm bg-[#0d1117] flex-1 overflow-x-auto">
            <div className="text-zinc-500 mb-2">@@ -42,3 +42,3 @@</div>
            <div className="text-red-400 bg-red-900/20 px-2 py-1 mb-1 whitespace-pre">
              - U4, TPS7A2033PDBVR, LDO 3.3V 300mA, SOT-23-5
            </div>
            <div className="text-green-400 bg-green-900/20 px-2 py-1 whitespace-pre">
              + U4, LD39130SJ33R, LDO 3.3V 300mA, SOT-23-5
            </div>
          </div>
        </div>

        {/* Right: LogicHub Semantic Diff */}
        <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl overflow-hidden flex flex-col shadow-[0_0_30px_rgba(245,158,11,0.1)]">
          <div className="bg-amber-500/10 p-4 border-b border-amber-500/20 flex justify-between items-center">
            <h2 className="font-bold text-sm text-amber-500 flex items-center gap-2">
              <span>⚡</span> LogicHub Semantic Diff
            </h2>
            <span className="text-xs text-red-400 font-bold uppercase tracking-widest animate-pulse">1 Constraint Failed</span>
          </div>
          <div className="p-6 space-y-6 flex-1">
            
            {/* Electrical Domain */}
            <div className="border border-white/5 rounded-xl p-4 bg-black/40">
              <h3 className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Electrical Domain
              </h3>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-300">Output Voltage</span>
                <span className="text-zinc-500 line-through">3.3V</span>
                <span className="text-blue-400 font-mono font-bold">3.3V (Unchanged)</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-2">
                <span className="text-zinc-300">Quiescent Current (Iq)</span>
                <span className="text-zinc-500 line-through">7 µA</span>
                <span className="text-red-400 font-mono font-bold">45 µA (+38 µA)</span>
              </div>
            </div>

            {/* Thermal/Mechanical Domain */}
            <div className="border border-red-500/30 rounded-xl p-4 bg-red-950/20">
              <h3 className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Thermal Constraints
              </h3>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-300">Thermal Resistance (θJA)</span>
                <span className="text-zinc-500 line-through">120 °C/W</span>
                <span className="text-amber-400 font-mono font-bold">210 °C/W</span>
              </div>
              <div className="mt-4 p-3 bg-red-900/20 border border-red-500/20 rounded-lg text-sm text-red-200">
                <strong>CRITICAL VIOLATION:</strong> Junction temperature simulation at max load (300mA) reaches 135°C, exceeding the component max rating of 125°C in the current enclosure model.
              </div>
            </div>

            {/* Firmware Domain */}
            <div className="border border-white/5 rounded-xl p-4 bg-black/40">
              <h3 className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span> Firmware Implication
              </h3>
              <div className="text-sm text-zinc-400">
                The new Iq of 45 µA violates the <code className="text-purple-400 bg-purple-900/30 px-1 rounded">DEEP_SLEEP_BUDGET</code> constraint (Max 10 µA). Firmware power estimation tests are marked as <span className="text-red-400 font-bold">FAILED</span>.
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}
