import HeroSection from './landing/HeroSection'
import PreviewSection from './landing/PreviewSection'
import HowItWorks from './landing/HowItWorks'
import PrivacySection from './landing/PrivacySection'
import FinalCTA from './landing/FinalCTA'

interface InputScreenProps {
  onError: (message: string) => void
  onDemoClick: () => void
}

function SectionDivider() {
  return (
    <div className="flex justify-center">
      <div className="w-24 h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent" />
    </div>
  )
}

export default function InputScreen({ onError, onDemoClick }: InputScreenProps) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <HeroSection onError={onError} onDemoClick={onDemoClick} />
      <SectionDivider />
      <PreviewSection />
      <SectionDivider />
      <HowItWorks />
      <SectionDivider />
      <PrivacySection />
      <SectionDivider />
      <FinalCTA onError={onError} onDemoClick={onDemoClick} />
    </div>
  )
}
