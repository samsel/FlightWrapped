import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  onReset: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    this.props.onReset()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-[#F5F1EB] text-[#1A1A1A] flex flex-col items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>Something went wrong</h1>
          <p className="text-[#6B6960] text-sm mb-6">
            An unexpected error occurred while rendering the dashboard.
          </p>
          {this.state.error && (
            <pre className="text-xs text-[#9B3A2A]/80 bg-[#FDDDD5]/30 border border-[#FDDDD5] p-4 mb-6 text-left overflow-x-auto max-h-32 rounded-lg">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            className="bg-[#2D5A27] hover:bg-[#3A7233] text-white text-sm font-medium px-6 py-3 transition-colors rounded-full"
          >
            Start Over
          </button>
        </div>
      </div>
    )
  }
}
