import type { Flight } from '@/lib/types'

// A diverse set of sample flights spanning multiple years, airlines, and continents.
// Used for the "Try with sample data" demo mode.
export const DEMO_FLIGHTS: Flight[] = [
  // North America domestic
  { origin: 'SFO', destination: 'JFK', date: '2023-01-15', airline: 'United', flightNumber: 'UA100', confidence: 1 },
  { origin: 'JFK', destination: 'SFO', date: '2023-01-22', airline: 'United', flightNumber: 'UA101', confidence: 1 },
  { origin: 'LAX', destination: 'ORD', date: '2023-02-10', airline: 'American', flightNumber: 'AA200', confidence: 1 },
  { origin: 'ORD', destination: 'LAX', date: '2023-02-14', airline: 'American', flightNumber: 'AA201', confidence: 1 },
  { origin: 'SFO', destination: 'SEA', date: '2023-03-05', airline: 'Alaska', flightNumber: 'AS300', confidence: 1 },
  { origin: 'SEA', destination: 'SFO', date: '2023-03-07', airline: 'Alaska', flightNumber: 'AS301', confidence: 1 },
  { origin: 'JFK', destination: 'MIA', date: '2023-04-12', airline: 'JetBlue', flightNumber: 'B6400', confidence: 1 },
  { origin: 'MIA', destination: 'JFK', date: '2023-04-16', airline: 'JetBlue', flightNumber: 'B6401', confidence: 1 },

  // Transatlantic
  { origin: 'JFK', destination: 'LHR', date: '2023-05-20', airline: 'British Airways', flightNumber: 'BA178', confidence: 1 },
  { origin: 'LHR', destination: 'CDG', date: '2023-05-23', airline: 'Air France', flightNumber: 'AF1081', confidence: 1 },
  { origin: 'CDG', destination: 'FCO', date: '2023-05-26', airline: 'Air France', flightNumber: 'AF1404', confidence: 1 },
  { origin: 'FCO', destination: 'JFK', date: '2023-05-30', airline: 'Alitalia', flightNumber: 'AZ608', confidence: 1 },

  // Asia Pacific
  { origin: 'SFO', destination: 'NRT', date: '2023-06-15', airline: 'ANA', flightNumber: 'NH7', confidence: 1 },
  { origin: 'NRT', destination: 'ICN', date: '2023-06-20', airline: 'ANA', flightNumber: 'NH863', confidence: 1 },
  { origin: 'ICN', destination: 'HKG', date: '2023-06-23', airline: 'Cathay Pacific', flightNumber: 'CX415', confidence: 1 },
  { origin: 'HKG', destination: 'SIN', date: '2023-06-26', airline: 'Singapore Airlines', flightNumber: 'SQ861', confidence: 1 },
  { origin: 'SIN', destination: 'SFO', date: '2023-06-30', airline: 'Singapore Airlines', flightNumber: 'SQ32', confidence: 1 },

  // Latin America
  { origin: 'MIA', destination: 'GRU', date: '2023-08-05', airline: 'LATAM', flightNumber: 'LA8101', confidence: 1 },
  { origin: 'GRU', destination: 'EZE', date: '2023-08-10', airline: 'LATAM', flightNumber: 'LA8030', confidence: 1 },
  { origin: 'EZE', destination: 'SCL', date: '2023-08-13', airline: 'LATAM', flightNumber: 'LA435', confidence: 1 },
  { origin: 'SCL', destination: 'MIA', date: '2023-08-17', airline: 'American', flightNumber: 'AA938', confidence: 1 },

  // More domestic + Canada
  { origin: 'SFO', destination: 'YVR', date: '2023-09-01', airline: 'Air Canada', flightNumber: 'AC554', confidence: 1 },
  { origin: 'YVR', destination: 'SFO', date: '2023-09-04', airline: 'Air Canada', flightNumber: 'AC555', confidence: 1 },
  { origin: 'LAX', destination: 'DEN', date: '2023-09-18', airline: 'Southwest', flightNumber: 'WN700', confidence: 1 },
  { origin: 'DEN', destination: 'LAX', date: '2023-09-20', airline: 'Southwest', flightNumber: 'WN701', confidence: 1 },

  // Middle East
  { origin: 'JFK', destination: 'DXB', date: '2023-10-10', airline: 'Emirates', flightNumber: 'EK202', confidence: 1 },
  { origin: 'DXB', destination: 'BOM', date: '2023-10-14', airline: 'Emirates', flightNumber: 'EK500', confidence: 1 },
  { origin: 'BOM', destination: 'DXB', date: '2023-10-18', airline: 'Emirates', flightNumber: 'EK501', confidence: 1 },
  { origin: 'DXB', destination: 'JFK', date: '2023-10-20', airline: 'Emirates', flightNumber: 'EK201', confidence: 1 },

  // Europe intra
  { origin: 'LHR', destination: 'BCN', date: '2023-11-02', airline: 'Vueling', flightNumber: 'VY6202', confidence: 1 },
  { origin: 'BCN', destination: 'AMS', date: '2023-11-05', airline: 'KLM', flightNumber: 'KL1668', confidence: 1 },
  { origin: 'AMS', destination: 'LHR', date: '2023-11-07', airline: 'KLM', flightNumber: 'KL1009', confidence: 1 },

  // Year 2 — more flying
  { origin: 'SFO', destination: 'JFK', date: '2024-01-10', airline: 'Delta', flightNumber: 'DL500', confidence: 1 },
  { origin: 'JFK', destination: 'SFO', date: '2024-01-14', airline: 'Delta', flightNumber: 'DL501', confidence: 1 },
  { origin: 'LAX', destination: 'HNL', date: '2024-02-15', airline: 'Hawaiian', flightNumber: 'HA11', confidence: 1 },
  { origin: 'HNL', destination: 'LAX', date: '2024-02-20', airline: 'Hawaiian', flightNumber: 'HA12', confidence: 1 },
  { origin: 'SFO', destination: 'LHR', date: '2024-03-20', airline: 'British Airways', flightNumber: 'BA286', confidence: 1 },
  { origin: 'LHR', destination: 'SFO', date: '2024-03-27', airline: 'British Airways', flightNumber: 'BA285', confidence: 1 },
  { origin: 'ORD', destination: 'MEX', date: '2024-04-05', airline: 'United', flightNumber: 'UA852', confidence: 1 },
  { origin: 'MEX', destination: 'ORD', date: '2024-04-09', airline: 'United', flightNumber: 'UA853', confidence: 1 },
  { origin: 'JFK', destination: 'IST', date: '2024-05-12', airline: 'Turkish Airlines', flightNumber: 'TK2', confidence: 1 },
  { origin: 'IST', destination: 'ATH', date: '2024-05-16', airline: 'Turkish Airlines', flightNumber: 'TK1845', confidence: 1 },
  { origin: 'ATH', destination: 'JFK', date: '2024-05-20', airline: 'Delta', flightNumber: 'DL241', confidence: 1 },
  { origin: 'SFO', destination: 'AKL', date: '2024-07-01', airline: 'Air New Zealand', flightNumber: 'NZ7', confidence: 1 },
  { origin: 'AKL', destination: 'SYD', date: '2024-07-06', airline: 'Qantas', flightNumber: 'QF146', confidence: 1 },
  { origin: 'SYD', destination: 'SFO', date: '2024-07-12', airline: 'Qantas', flightNumber: 'QF73', confidence: 1 },
]
