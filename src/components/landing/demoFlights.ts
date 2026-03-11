import type { Flight } from '@/lib/types'

// A diverse set of sample flights spanning 2020-2025.
// SFO-based traveler: business trips to NYC/Asia, leisure to Europe/South America/Oceania.
export const DEMO_FLIGHTS: Flight[] = [
  // 2020
  { origin: 'SFO', destination: 'JFK', date: '2020-01-12', airline: 'United', flightNumber: 'UA100', confidence: 1 },
  { origin: 'JFK', destination: 'SFO', date: '2020-01-17', airline: 'United', flightNumber: 'UA101', confidence: 1 },
  { origin: 'SFO', destination: 'LAX', date: '2020-02-08', airline: 'United', flightNumber: 'UA418', confidence: 1 },
  { origin: 'LAX', destination: 'SFO', date: '2020-02-10', airline: 'United', flightNumber: 'UA419', confidence: 1 },

  // 2021
  { origin: 'SFO', destination: 'SEA', date: '2021-03-20', airline: 'Alaska', flightNumber: 'AS310', confidence: 1 },
  { origin: 'SEA', destination: 'SFO', date: '2021-03-23', airline: 'Alaska', flightNumber: 'AS311', confidence: 1 },
  { origin: 'SFO', destination: 'JFK', date: '2021-06-05', airline: 'United', flightNumber: 'UA100', confidence: 1 },
  { origin: 'JFK', destination: 'SFO', date: '2021-06-10', airline: 'United', flightNumber: 'UA101', confidence: 1 },
  { origin: 'SFO', destination: 'HNL', date: '2021-09-15', airline: 'Hawaiian', flightNumber: 'HA12', confidence: 1 },
  { origin: 'HNL', destination: 'SFO', date: '2021-09-22', airline: 'Hawaiian', flightNumber: 'HA13', confidence: 1 },

  // 2022
  { origin: 'SFO', destination: 'JFK', date: '2022-02-14', airline: 'United', flightNumber: 'UA100', confidence: 1 },
  { origin: 'JFK', destination: 'LHR', date: '2022-02-15', airline: 'British Airways', flightNumber: 'BA178', confidence: 1 },
  { origin: 'LHR', destination: 'CDG', date: '2022-02-20', airline: 'British Airways', flightNumber: 'BA304', confidence: 1 },
  { origin: 'CDG', destination: 'BCN', date: '2022-02-24', airline: 'Air France', flightNumber: 'AF1148', confidence: 1 },
  { origin: 'BCN', destination: 'AMS', date: '2022-02-28', airline: 'KLM', flightNumber: 'KL1668', confidence: 1 },
  { origin: 'AMS', destination: 'SFO', date: '2022-03-03', airline: 'KLM', flightNumber: 'KL605', confidence: 1 },
  { origin: 'SFO', destination: 'LAX', date: '2022-05-10', airline: 'United', flightNumber: 'UA418', confidence: 1 },
  { origin: 'LAX', destination: 'DEN', date: '2022-05-13', airline: 'Southwest', flightNumber: 'WN702', confidence: 1 },
  { origin: 'DEN', destination: 'SFO', date: '2022-05-16', airline: 'United', flightNumber: 'UA564', confidence: 1 },

  // 2023 (peak travel year)
  { origin: 'SFO', destination: 'NRT', date: '2023-01-08', airline: 'ANA', flightNumber: 'NH7', confidence: 1 },
  { origin: 'NRT', destination: 'ICN', date: '2023-01-13', airline: 'ANA', flightNumber: 'NH863', confidence: 1 },
  { origin: 'ICN', destination: 'SIN', date: '2023-01-17', airline: 'Singapore Airlines', flightNumber: 'SQ607', confidence: 1 },
  { origin: 'SIN', destination: 'BKK', date: '2023-01-22', airline: 'Singapore Airlines', flightNumber: 'SQ978', confidence: 1 },
  { origin: 'BKK', destination: 'HKG', date: '2023-01-27', airline: 'Cathay Pacific', flightNumber: 'CX700', confidence: 1 },
  { origin: 'HKG', destination: 'SFO', date: '2023-01-30', airline: 'Cathay Pacific', flightNumber: 'CX872', confidence: 1 },
  { origin: 'SFO', destination: 'JFK', date: '2023-03-18', airline: 'United', flightNumber: 'UA100', confidence: 1 },
  { origin: 'JFK', destination: 'SFO', date: '2023-03-22', airline: 'United', flightNumber: 'UA101', confidence: 1 },
  { origin: 'SFO', destination: 'ORD', date: '2023-05-06', airline: 'United', flightNumber: 'UA632', confidence: 1 },
  { origin: 'ORD', destination: 'SFO', date: '2023-05-09', airline: 'United', flightNumber: 'UA633', confidence: 1 },
  { origin: 'JFK', destination: 'DXB', date: '2023-06-20', airline: 'Emirates', flightNumber: 'EK202', confidence: 1 },
  { origin: 'DXB', destination: 'BOM', date: '2023-06-25', airline: 'Emirates', flightNumber: 'EK500', confidence: 1 },
  { origin: 'BOM', destination: 'DXB', date: '2023-06-30', airline: 'Emirates', flightNumber: 'EK501', confidence: 1 },
  { origin: 'DXB', destination: 'JFK', date: '2023-07-03', airline: 'Emirates', flightNumber: 'EK203', confidence: 1 },
  { origin: 'SFO', destination: 'LAX', date: '2023-09-02', airline: 'Delta', flightNumber: 'DL755', confidence: 1 },
  { origin: 'LAX', destination: 'SFO', date: '2023-09-04', airline: 'Delta', flightNumber: 'DL756', confidence: 1 },

  // 2024
  { origin: 'SFO', destination: 'SYD', date: '2024-02-01', airline: 'Qantas', flightNumber: 'QF74', confidence: 1 },
  { origin: 'SYD', destination: 'AKL', date: '2024-02-07', airline: 'Air New Zealand', flightNumber: 'NZ110', confidence: 1 },
  { origin: 'AKL', destination: 'SFO', date: '2024-02-12', airline: 'Air New Zealand', flightNumber: 'NZ7', confidence: 1 },
  { origin: 'SFO', destination: 'JFK', date: '2024-04-10', airline: 'United', flightNumber: 'UA100', confidence: 1 },
  { origin: 'JFK', destination: 'LIS', date: '2024-04-11', airline: 'Delta', flightNumber: 'DL262', confidence: 1 },
  { origin: 'LIS', destination: 'IST', date: '2024-04-16', airline: 'Turkish Airlines', flightNumber: 'TK1760', confidence: 1 },
  { origin: 'IST', destination: 'ATH', date: '2024-04-20', airline: 'Turkish Airlines', flightNumber: 'TK1845', confidence: 1 },
  { origin: 'ATH', destination: 'SFO', date: '2024-04-24', airline: 'United', flightNumber: 'UA41', confidence: 1 },
  { origin: 'MIA', destination: 'GRU', date: '2024-07-05', airline: 'LATAM', flightNumber: 'LA8101', confidence: 1 },
  { origin: 'GRU', destination: 'EZE', date: '2024-07-10', airline: 'LATAM', flightNumber: 'LA8030', confidence: 1 },
  { origin: 'EZE', destination: 'MIA', date: '2024-07-15', airline: 'American', flightNumber: 'AA938', confidence: 1 },

  // 2025
  { origin: 'SFO', destination: 'MEX', date: '2025-01-18', airline: 'United', flightNumber: 'UA852', confidence: 1 },
  { origin: 'MEX', destination: 'SFO', date: '2025-01-23', airline: 'United', flightNumber: 'UA853', confidence: 1 },
  { origin: 'SFO', destination: 'YVR', date: '2025-03-08', airline: 'Air Canada', flightNumber: 'AC554', confidence: 1 },
  { origin: 'YVR', destination: 'SFO', date: '2025-03-11', airline: 'Air Canada', flightNumber: 'AC555', confidence: 1 },
]
