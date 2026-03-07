import { useInView } from './useInView'
import { ShieldIcon, EyeOffIcon, ServerOffIcon } from './icons'

const PILLARS = [
  {
    Icon: ShieldIcon,
    title: 'Browser-only processing',
    description:
      'All email parsing, AI extraction, and stat calculation happen right here in your browser tab. Nothing is uploaded anywhere.',
  },
  {
    Icon: EyeOffIcon,
    title: 'Read-only access',
    description:
      'We request the minimum Gmail scope: read-only access to messages. We cannot send, modify, or delete anything.',
  },
  {
    Icon: ServerOffIcon,
    title: 'Zero servers',
    description:
      'There is no backend. No database. No analytics tracking. When you close this tab, it\'s gone.',
  },
]

export default function PrivacySection() {
  const [ref, inView] = useInView(0.1)

  return (
    <section
      ref={ref as React.RefObject<HTMLDivElement>}
      className="relative py-20 md:py-32 px-6 overflow-hidden"
    >
      <div className="relative max-w-4xl mx-auto">
        {/* Section header */}
        <div className={`text-center mb-16 transition-all duration-1000 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-emerald-400/80 text-sm font-medium tracking-widest uppercase mb-4">Privacy</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
            Your data stays yours
          </h2>
          <p className="text-gray-500 text-lg">Privacy isn't a feature — it's the architecture.</p>
        </div>

        {/* Pillars container */}
        <div className={`gradient-border transition-all duration-1000 delay-200 ${
          inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}>
          <div className="p-8 md:p-10">
            {/* Architecture diagram */}
            <div className={`flex items-center justify-center gap-3 mb-10 flex-wrap transition-all duration-700 delay-500 ${
              inView ? 'opacity-100' : 'opacity-0'
            }`}>
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>
                Your Browser
              </div>
              <div className="flex items-center gap-1 text-gray-600">
                <div className="w-8 h-px bg-emerald-500/30" />
                <svg className="w-4 h-4 text-emerald-500/50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
                <div className="w-8 h-px bg-emerald-500/30" />
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                Gmail API
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
              {PILLARS.map((pillar, i) => (
                <div
                  key={pillar.title}
                  className={`text-center transition-all duration-700 ${
                    inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                  }`}
                  style={{ transitionDelay: inView ? `${600 + i * 150}ms` : '0ms' }}
                >
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/10 border border-emerald-500/10 mb-5">
                    <pillar.Icon className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="font-semibold text-white mb-3">{pillar.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{pillar.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
