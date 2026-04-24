"use client";

import { useEffect, useState } from "react";

interface AppItem {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  download_url: string;
  downloads: number;
  trend_score: number;
}

export default function Home() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [repoUrl, setRepoUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activities, setActivities] = useState<string[]>([]);

  // Fetch apps on load
  const fetchApps = async () => {
    try {
      const res = await fetch("http://localhost:4001/apps");
      const data = await res.json();
      setApps(data);
    } catch (err) {
      console.error("Failed to fetch apps", err);
    }
  };

  useEffect(() => {
    fetchApps();
    // Fetch live activity from Redis feed
    const fetchActivity = async () => {
      try {
        const res = await fetch("http://localhost:4001/activity");
        const data = await res.json();
        const msgs = data.map((item: any) => 
          item.type === "download" 
            ? `🔥 Someone downloaded "${item.app}"` 
            : `🚀 New app dropped: "${item.app}"`
        );
        setActivities(msgs);
      } catch (err) {
        console.error("Failed to fetch activity", err);
      }
    };

    const interval = setInterval(fetchActivity, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDownload = async (id: string) => {
    await fetch(`http://localhost:4001/download/${id}`, { method: "POST" });
    fetchApps();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl) return;

    setIsAnalyzing(true);
    try {
      // 1. Analyze via AI Service
      const aiRes = await fetch("http://localhost:5001/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_url: repoUrl })
      });
      const aiData = await aiRes.json();

      // 2. Submit to Market API (including Zayvora metadata)
      const submitRes = await fetch("http://localhost:4001/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: aiData.title || "New App",
          tagline: aiData.tagline,
          description: aiData.improved_summary || aiData.summary,
          download_url: repoUrl,
          repo_url: repoUrl,
          publish: aiData.publish // The Zayvora Publish Gate
        })
      });
      
      if (submitRes.ok) {
        setRepoUrl("");
        fetchApps();
      } else {
        const errorData = await submitRes.json();
        alert(errorData.error || "Submission failed");
      }
    } catch (err) {
      console.error("Submission failed", err);
      alert("System overload. Please try again in a few minutes.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans p-6">
      <header className="max-w-6xl mx-auto mb-12 flex justify-between items-center">
        <div>
          <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
            LOGICHUB
          </h1>
          <p className="text-gray-400 mt-2 font-medium">Download insanely useful apps. No login. No friction.</p>
        </div>
        
        {/* Activity Feed Mini */}
        <div className="hidden md:block w-64 bg-zinc-900/50 p-3 rounded-xl border border-white/5 text-xs">
          <h3 className="text-zinc-500 uppercase tracking-widest font-bold mb-2">Live Activity</h3>
          <div className="space-y-2">
            {activities.length > 0 ? activities.map((a, i) => (
              <div key={i} className="animate-in fade-in slide-in-from-top-1 duration-500">
                {a}
              </div>
            )) : <div className="text-zinc-600 italic">Waiting for signal...</div>}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        {/* Viral Submission Box */}
        <section className="mb-16 bg-gradient-to-br from-zinc-900 to-black p-8 rounded-3xl border border-white/10 shadow-2xl">
          <h2 className="text-2xl font-bold mb-4">Drop a GitHub repo. Get a viral app page.</h2>
          <form onSubmit={handleSubmit} className="flex gap-4">
            <input
              type="text"
              placeholder="https://github.com/user/repo"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              disabled={isAnalyzing}
            />
            <button
              type="submit"
              disabled={isAnalyzing}
              className="bg-green-500 hover:bg-green-400 text-black font-black px-8 py-3 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <span className="animate-spin text-xl">⚙️</span> Analyzing...
                </>
              ) : "Drop It"}
            </button>
          </form>
        </section>

        {/* Apps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map((app) => (
            <div key={app.id} className="group bg-zinc-900/40 hover:bg-zinc-900/80 p-6 rounded-3xl border border-white/5 transition-all duration-300 hover:scale-[1.02] hover:border-white/20">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold">{app.name}</h3>
                {app.trend_score > 5 && (
                  <span className="bg-orange-500/10 text-orange-500 text-[10px] font-black uppercase px-2 py-1 rounded-full border border-orange-500/20 animate-pulse">
                    Hot
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-sm mb-6 line-clamp-2">{app.tagline}</p>
              
              <div className="flex items-center gap-4 text-xs text-zinc-500 mb-6">
                <span className="flex items-center gap-1">
                  🔥 <span className="text-white font-bold">{app.downloads}</span> downloads
                </span>
                <span className="flex items-center gap-1">
                  ⚡ <span className="text-white font-bold">{app.trend_score.toFixed(1)}</span> trend
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload(app.id)}
                  className="flex-1 bg-white text-black font-bold py-2 rounded-xl hover:bg-green-400 transition-colors"
                >
                  Download
                </button>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch("http://localhost:6000/share", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ app })
                      });
                      const { tweet } = await res.json();
                      navigator.clipboard.writeText(tweet);
                      alert("Viral share text copied!");
                    } catch (err) {
                      navigator.clipboard.writeText(`Check this app: ${app.name}`);
                      alert("Share link copied!");
                    }
                  }}
                  className="px-4 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-sm font-bold"
                >
                  Share
                </button>
              </div>
            </div>
          ))}
          {apps.length === 0 && !isAnalyzing && (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
              <div className="text-4xl mb-4">🌵</div>
              <h3 className="text-zinc-500 font-bold">Marketplace is empty. Be the first to drop an app.</h3>
            </div>
          )}
        </div>
      </main>

      <footer className="max-w-6xl mx-auto mt-32 py-12 border-t border-white/5 text-center text-zinc-600 text-sm">
        Built by Antigravity Synthesis Orchestrator • Powered by Zayvora
      </footer>
    </div>
  );
}
