import Link from 'next/link';

export default function CampaignNotFound() {
  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-6">
        <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Campaign evidence console</div>
        <h1 className="mt-2 text-2xl font-bold">Campaign not found</h1>
        <p className="mt-3 text-sm text-zinc-400">No fixture or connected authoritative campaign record exists for this ID. Unknown does not become a demo PASS.</p>
        <Link href="/" className="mt-5 inline-block text-sm text-blue-400 hover:underline">← Return to LogicHub</Link>
      </div>
    </main>
  );
}
