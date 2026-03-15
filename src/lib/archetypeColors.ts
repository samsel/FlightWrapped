const ARCHETYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'commuter': { bg: 'bg-[#FFF3CD]', text: 'text-[#8B6914]', border: 'border-[#E5D49A]' },
  'explorer': { bg: 'bg-[#E8F0E4]', text: 'text-[#2D5A27]', border: 'border-[#C8DCC2]' },
  'road-warrior': { bg: 'bg-[#FDDDD5]', text: 'text-[#9B3A2A]', border: 'border-[#F0B8AA]' },
  'long-hauler': { bg: 'bg-[#EDE4F5]', text: 'text-[#6B3FA0]', border: 'border-[#D4C4E4]' },
  'weekender': { bg: 'bg-[#E0F0F0]', text: 'text-[#2A6B6B]', border: 'border-[#B8D8D8]' },
  'occasional-flyer': { bg: 'bg-[#E8F0E4]', text: 'text-[#2D5A27]', border: 'border-[#C8DCC2]' },
}

const DEFAULT = { bg: 'bg-[#E8F0E4]', text: 'text-[#2D5A27]', border: 'border-[#C8DCC2]' }

export function getArchetypeColors(id: string) {
  return ARCHETYPE_COLORS[id] ?? DEFAULT
}
