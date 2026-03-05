import { useInView } from './useInView'
import { LockIcon, SparklesIcon, GlobeIcon } from './icons'

const STEPS = [
  {
    number: '01',
    title: 'Connect securely',
    description:
      'One-click Gmail sign-in with read-only access. We use Google\'s official OAuth — no passwords stored.',
    Icon: LockIcon,
    color: 'from-blue-500/20 to-cyan-500/20',
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
  },
  {
    number: '02',
    title: 'AI extracts flights',
    description:
      'A 3-tier engine (structured data, regex, local AI) finds every flight confirmation. Runs entirely in your browser.',
    Icon: SparklesIcon,
    color: 'from-purple-500/20 to-pink-500/20',
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/10',
  },
  {
    number: '03',
    title: 'Explore your stats',
    description:
      'Interactive 3D globe, airline breakdowns, fun comparisons, and a shareable stats card.',
    Icon: GlobeIcon,
    color: 'from-emerald-500/20 to-teal-500/20',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
  },
]

export default function HowItWorks() {
  const [ref, inView] = useInView(0.1)

  return (
    <section
      ref={ref as React.RefObject<HTMLDivElement>}
      className="relative py-32 px-6 overflow-hidden"
    >
      {/* Background orb */}
      <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-4xl mx-auto">
        {/* Section header */}
        <div className={`text-center mb-16 transition-all duration-1000 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-purple-400/80 text-sm font-medium tracking-widest uppercase mb-4">How it works</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
            Three steps. Thirty seconds.
          </h2>
          <p className="text-gray-500 text-lg">Zero data leaves your browser.</p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              className={`relative glass-card rounded-2xl p-7 transition-all duration-700 hover:scale-[1.02] group ${
                inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
              style={{ transitionDelay: inView ? `${300 + i * 200}ms` : '0ms' }}
            >
              {/* Top gradient accent line */}
              <div className={`absolute top-0 left-6 right-6 h-px bg-gradient-to-r ${step.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

              {/* Step number */}
              <span className="text-xs font-mono text-gray-600 tracking-wider">{step.number}</span>

              {/* Icon */}
              <div className={`w-11 h-11 rounded-xl ${step.iconBg} flex items-center justify-center mt-4 mb-5 transition-transform duration-300 group-hover:scale-110`}>
                <step.Icon className={`w-5 h-5 ${step.iconColor}`} />
              </div>

              {/* Content */}
              <h3 className="font-semibold text-lg text-white mb-2">{step.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
