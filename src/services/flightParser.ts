export interface Flight {
    airline: string;
    flightNumber: string;
    departureAirport: string;
    arrivalAirport: string;
    departureTime: string; // ISO string
    distance?: number; // Miles
}

export const parseFlightEmail = (subject: string, body: string): Flight | null => {
    // Very basic heuristics for demo purposes
    // Real implementation would need robust parsing or AI extraction

    if (!subject.toLowerCase().includes("flight") && !subject.toLowerCase().includes("booking")) {
        return null;
    }

    // Example: "Flight confirmation: DL123 from JFK to LHR"
    const flightNumRegex = /([A-Z]{2}\s?\d{3,4})/;
    const airportRegex = /\b([A-Z]{3})\b.*to.*\b([A-Z]{3})\b/i;

    const flightNumMatch = body.match(flightNumRegex) || subject.match(flightNumRegex);
    const airportMatch = body.match(airportRegex) || subject.match(airportRegex);

    if (flightNumMatch) {
        return {
            airline: "Unknown", // Would need mapping from code (DL -> Delta)
            flightNumber: flightNumMatch[1],
            departureAirport: airportMatch ? airportMatch[1].toUpperCase() : "XXX",
            arrivalAirport: airportMatch ? airportMatch[2].toUpperCase() : "XXX",
            departureTime: new Date().toISOString(), // Mock
            distance: 0, // Mock
        };
    }

    return null;
};
