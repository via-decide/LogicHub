import Link from "next/link";

export function TopNav({ crumbs }: { crumbs: { label: string; href?: string }[] }) {
  return (
    <header className="border-b border-white/10 bg-black/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
        <Link href="/projects" className="font-mono text-sm font-bold tracking-widest text-amber-400">
          LOGICHUB
        </Link>
        <nav className="flex items-center gap-2 text-sm text-zinc-400">
          {crumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="text-zinc-600">/</span>
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-white">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-white">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>
    </header>
  );
}
