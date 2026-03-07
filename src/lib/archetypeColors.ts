const ARCHETYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'commuter': { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  'explorer': { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  'road-warrior': { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
  'long-hauler': { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30' },
  'weekender': { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  'occasional-flyer': { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
}

const DEFAULT = { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' }

export function getArchetypeColors(id: string) {
  return ARCHETYPE_COLORS[id] ?? DEFAULT
}
