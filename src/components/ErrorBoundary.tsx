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
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-3">Something went wrong</h1>
          <p className="text-gray-400 text-sm mb-6">
            An unexpected error occurred while rendering the dashboard.
          </p>
          {this.state.error && (
            <pre className="text-xs text-red-400/80 bg-red-950/30 border border-red-900/30 p-4 mb-6 text-left overflow-x-auto max-h-32">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-6 py-3 transition-colors"
          >
            Start Over
          </button>
        </div>
      </div>
    )
  }
}
