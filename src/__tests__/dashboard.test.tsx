import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import type { FlightStats, FunStats, Archetype, Insight, Flight } from '@/lib/types'

// Mock modules that require browser APIs not available in jsdom
vi.mock('@/lib/airports', () => ({
  lookupAirport: vi.fn().mockReturnValue({ iata: 'JFK', city: 'New York', country: 'US', lat: 40.6, lng: -73.7, timezone: 'America/New_York', name: 'John F. Kennedy' }),
  calculateDistance: vi.fn().mockReturnValue(2475),
  isValidIATA: vi.fn().mockReturnValue(true),
}))

vi.mock('react-globe.gl', () => ({
  default: vi.fn().mockReturnValue(null),
  __esModule: true,
}))

const mockStats: FlightStats = {
  totalFlights: 10,
  totalMiles: 25000,
  uniqueAirports: 5,
  uniqueCities: 5,
  uniqueCountries: 3,
  uniqueAirlines: 4,
  airlineBreakdown: { United: 5, Delta: 3, AA: 2 },
  mostFlownRoute: { origin: 'JFK', destination: 'LAX', count: 3 },
  mostVisitedAirport: { iata: 'JFK', count: 8 },
  busiestMonth: { month: '2024-03', count: 4 },
  firstFlight: { origin: 'JFK', destination: 'LAX', date: '2023-01-15', airline: 'United', flightNumber: 'UA 100', confidence: 0.9 },
  lastFlight: { origin: 'SFO', destination: 'ORD', date: '2024-06-01', airline: 'Delta', flightNumber: 'DL 200', confidence: 0.85 },
  longestRoute: { origin: 'JFK', destination: 'NRT', miles: 6740 },
  shortestRoute: { origin: 'JFK', destination: 'BOS', miles: 190 },
  domesticRatio: 0.6,
  flightsByYear: { '2023': 4, '2024': 6 },
  estimatedHours: 50,
  co2Tons: 6.375,
  flightsByMonth: { '2023-06': 2, '2024-03': 4 },
}

const mockFunStats: FunStats = {
  earthOrbits: 1.0,
  moonPercent: 10.5,
  daysInAir: 2.1,
  speedComparison: 161,
  distanceLabel: "that's a lot of flying!",
}

const mockArchetype: Archetype = {
  id: 'explorer',
  name: 'The Explorer',
  description: 'You love new airports',
  icon: 'compass',
}

const mockInsights: Insight[] = [
  { id: 'globe-trotter', title: 'Globe Trotter', description: '3 countries', icon: 'globe' },
]

const mockFlights: Flight[] = [
  { origin: 'JFK', destination: 'LAX', date: '2024-01-15', airline: 'United', flightNumber: 'UA 100', confidence: 0.9 },
]

describe('DashboardHeader', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('renders archetype name with emoji icon', async () => {
    const { default: DashboardHeader } = await import('@/components/dashboard/DashboardHeader')
    render(
      <DashboardHeader
        stats={mockStats}
        funStats={mockFunStats}
        archetype={mockArchetype}
        flights={mockFlights}
        onReset={() => {}}
      />,
    )
    // getIcon('compass') returns '🧭' — ShareCard also renders it (off-screen)
    expect(screen.getAllByText(/The Explorer/)).toHaveLength(2)
  })

  it('renders Start Over button', async () => {
    const { default: DashboardHeader } = await import('@/components/dashboard/DashboardHeader')
    render(
      <DashboardHeader
        stats={mockStats}
        funStats={mockFunStats}
        archetype={mockArchetype}
        flights={mockFlights}
        onReset={() => {}}
      />,
    )
    expect(screen.getByText('Start Over')).toBeInTheDocument()
  })
})

describe('FunStatsRow', () => {
  it('renders earth orbits, moon journey, and days in air', async () => {
    const { default: FunStatsRow } = await import('@/components/dashboard/FunStatsRow')
    render(<FunStatsRow funStats={mockFunStats} />)
    expect(screen.getByText('Earth Orbits')).toBeInTheDocument()
    expect(screen.getByText('Moon Journey')).toBeInTheDocument()
    expect(screen.getByText('Days in Air')).toBeInTheDocument()
  })

  it('renders speed comparison when present', async () => {
    const { default: FunStatsRow } = await import('@/components/dashboard/FunStatsRow')
    render(<FunStatsRow funStats={mockFunStats} />)
    expect(screen.getByText('vs Walking')).toBeInTheDocument()
    expect(screen.getByText('161×')).toBeInTheDocument()
  })

  it('renders distance label', async () => {
    const { default: FunStatsRow } = await import('@/components/dashboard/FunStatsRow')
    render(<FunStatsRow funStats={mockFunStats} />)
    expect(screen.getByText("that's a lot of flying!")).toBeInTheDocument()
  })
})

describe('InsightsRow', () => {
  it('renders insight cards', async () => {
    const { default: InsightsRow } = await import('@/components/dashboard/InsightsRow')
    render(<InsightsRow insights={mockInsights} />)
    expect(screen.getByText('Globe Trotter')).toBeInTheDocument()
    expect(screen.getByText('3 countries')).toBeInTheDocument()
  })

  it('renders nothing for empty insights', async () => {
    const { default: InsightsRow } = await import('@/components/dashboard/InsightsRow')
    const { container } = render(<InsightsRow insights={[]} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('FlightList', () => {
  it('renders flight table with data', async () => {
    const { default: FlightList } = await import('@/components/dashboard/FlightList')
    render(<FlightList flights={mockFlights} />)
    expect(screen.getByText('All Flights')).toBeInTheDocument()
    expect(screen.getByText('2024-01-15')).toBeInTheDocument()
  })

  it('shows empty state when no flights', async () => {
    const { default: FlightList } = await import('@/components/dashboard/FlightList')
    render(<FlightList flights={[]} />)
    expect(screen.getByText('No flights extracted')).toBeInTheDocument()
  })
})
