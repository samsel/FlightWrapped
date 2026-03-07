import { useInView } from './useInView'
import { useCountUp } from '@/hooks/useCountUp'

const SAMPLE_STATS = [
  { emoji: '✈️', value: 147, label: 'Flights', suffix: '' },
  { emoji: '🌍', value: 284, label: 'Thousand Miles', suffix: 'k' },
  { emoji: '📍', value: 43, label: 'Airports', suffix: '' },
  { emoji: '🏳️', value: 18, label: 'Countries', suffix: '' },
  { emoji: '🛫', value: 12, label: 'Airlines', suffix: '' },
  { emoji: '🕐', value: 583, label: 'Hours in Air', suffix: '' },
]

const SAMPLE_FUN_STATS = [
  { emoji: '🌎', value: '7.1', label: 'Earth Orbits' },
  { emoji: '🌙', value: '44%', label: 'to the Moon' },
  { emoji: '☁️', value: '24.3', label: 'Days in Air' },
]

function CountingStat({ emoji, value, label, suffix, started }: {
  emoji: string
  value: number
  label: string
  suffix: string
  started: boolean
}) {
  const count = useCountUp(value, 2000, started)
  return (
    <div className="glass-card p-5 transition-all duration-300 group">
      <span className="text-xl block mb-1">{emoji}</span>
      <p className="text-2xl md:text-4xl font-bold mt-1 text-white">
        {started ? count.toLocaleString() : '0'}{suffix}
      </p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  )
}

export default function PreviewSection() {
  const [ref, inView] = useInView(0.1)

  return (
    <section
      id="preview"
      ref={ref as React.RefObject<HTMLDivElement>}
      className="relative py-20 md:py-32 px-6 overflow-hidden"
    >
      <div className="relative max-w-4xl mx-auto">
        {/* Section header */}
        <div className={`text-center mb-16 transition-all duration-1000 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-blue-400/80 text-sm font-medium tracking-widest uppercase mb-4">Preview</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
            What you'll discover
          </h2>
          <p className="text-gray-500 text-lg">A complete picture of your travel history</p>
        </div>

        {/* Preview card with gradient border */}
        <div className={`gradient-border p-6 md:p-8 transition-all duration-1000 delay-200 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-5">
            {SAMPLE_STATS.map((stat) => (
              <CountingStat key={stat.label} {...stat} started={inView} />
            ))}
          </div>

          {/* Fun stats row */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            {SAMPLE_FUN_STATS.map((stat) => (
              <div
                key={stat.label}
                className="flex-1 p-4 flex items-center gap-3 bg-blue-500/5 border border-blue-500/10 transition-all duration-300 hover:bg-blue-500/10"
              >
                <span className="text-2xl">{stat.emoji}</span>
                <div>
                  <p className="text-xl font-bold text-blue-300">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Archetype badge */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2.5 bg-blue-500/10 border border-blue-500/20 px-6 py-2.5 text-sm font-medium text-blue-200">
              <span>🧭</span>
              Your archetype: <span className="text-white font-semibold">The Explorer</span>
            </div>
          </div>
        </div>

        {/* Label */}
        <p className="text-center text-xs text-gray-700 mt-6 tracking-wide">Sample data shown above</p>
      </div>
    </section>
  )
}
