import GmailConnect from './GmailConnect'

interface InputScreenProps {
  onError: (message: string) => void
}

export default function InputScreen({ onError }: InputScreenProps) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
      <div className="max-w-xl w-full text-center">
        <h1 className="text-5xl font-bold mb-3">MyFlights</h1>
        <p className="text-gray-400 text-lg mb-12">
          Your flight stats, visualized. Your emails never leave your browser.
        </p>

        <div className="space-y-8">
          {/* Gmail OAuth path */}
          <div className="flex flex-col items-center gap-3">
            <GmailConnect onError={onError} />
            <p className="text-xs text-gray-500">
              Read-only access. Nothing is stored or sent anywhere.
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-16 text-left">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Step number={1} title="Connect" description="Connect your Gmail" />
            <Step number={2} title="Extract" description="AI finds flights in your emails" />
            <Step number={3} title="Visualize" description="See your flight stats on a 3D globe" />
          </div>
        </div>
      </div>
    </div>
  )
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg">
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold">
        {number}
      </span>
      <div>
        <p className="font-medium text-gray-200">{title}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </div>
  )
}
