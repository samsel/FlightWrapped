import { useState } from "react";
import { signIn, fetchEmails, fetchEmailDetails } from "./services/googleApi";
import { parseFlightEmail, Flight } from "./services/flightParser";
import { Plane, Calendar, MapPin, RefreshCw, LogIn } from "lucide-react";
import "./App.css";

function App() {
  const [loading, setLoading] = useState(false);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [status, setStatus] = useState("");

  const handleLogin = async () => {
    try {
      setLoading(true);
      setStatus("Connecting to Google...");
      await signIn();
      setIsAuthenticated(true);
      setStatus("Connected! Fetching flights...");
      await loadFlights();
    } catch (error) {
      console.error(error);
      setStatus(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const loadFlights = async () => {
    try {
      setLoading(true);
      setStatus("Scanning emails...");
      // Search generically for flight confirmations
      const response = await fetchEmails('subject:("flight confirmation" OR "booking confirmed")');

      const newFlights: Flight[] = [];
      const messages = response.messages || [];

      setStatus(`Found ${messages.length} potential emails. Parsing...`);

      for (const msg of messages) {
        // Fetch full details
        const detail = await fetchEmailDetails(msg.id);
        const subjectHeader = detail.payload.headers.find((h: any) => h.name === "Subject");
        const bodySnippet = detail.snippet; // Using snippet for simple demo, full body parsing is heavier

        if (subjectHeader) {
          const flight = parseFlightEmail(subjectHeader.value, bodySnippet);
          if (flight) {
            newFlights.push(flight);
          }
        }
      }

      setFlights(newFlights);
      setStatus(`Done! Found ${newFlights.length} flights.`);
    } catch (error) {
      console.error(error);
      setStatus("Failed to load flights.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      <header className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Plane className="text-blue-500" /> MyFlights
        </h1>
        {isAuthenticated && (
          <button
            onClick={loadFlights}
            disabled={loading}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        )}
      </header>

      {!isAuthenticated ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Plane className="w-24 h-24 text-gray-700 mb-6" />
          <h2 className="text-2xl font-semibold mb-4">Track your travel history locally</h2>
          <p className="text-gray-400 mb-8 max-w-md">
            Connect your Gmail to scan for flight confirmations.
            Your data stays on your device.
          </p>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-medium transition shadow-lg shadow-blue-900/20"
          >
            {loading ? <RefreshCw className="animate-spin" /> : <LogIn />}
            Connect with Google
          </button>
          {status && <p className="mt-4 text-sm text-gray-500">{status}</p>}
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <StatCard title="Total Flights" value={flights.length.toString()} icon={<Plane />} />
            <StatCard title="Unique Airports" value={countUniqueAirports(flights).toString()} icon={<MapPin />} />
            <StatCard title="Airlines" value={countUniqueAirlines(flights).toString()} icon={<Calendar />} />
          </div>

          <h3 className="text-xl font-semibold mb-4">Recent Flights</h3>
          <div className="grid gap-4">
            {flights.length === 0 ? (
              <p className="text-gray-500 italic">No flights found yet. Try scanning.</p>
            ) : (
              flights.map((flight, i) => (
                <div key={i} className="bg-gray-800 p-4 rounded-xl flex justify-between items-center border border-gray-700">
                  <div className="flex items-center gap-4">
                    <div className="bg-gray-700 p-3 rounded-lg">
                      <Plane className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">{flight.departureAirport} → {flight.arrivalAirport}</h4>
                      <p className="text-sm text-gray-400">{flight.airline} • {flight.flightNumber}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Unknown Date</p>
                  </div>
                </div>
              ))
            )}
          </div>
          {status && <p className="mt-4 text-sm text-gray-500 text-center">{status}</p>}
        </div>
      )}
    </div>
  );
}

const StatCard = ({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) => (
  <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
    <div className="flex justify-between items-start mb-4">
      <div className="text-gray-400">{title}</div>
      <div className="text-gray-500 bg-gray-700/50 p-2 rounded-lg">{icon}</div>
    </div>
    <div className="text-4xl font-bold">{value}</div>
  </div>
);

function countUniqueAirports(flights: Flight[]) {
  const airports = new Set();
  flights.forEach(f => {
    if (f.departureAirport !== "XXX") airports.add(f.departureAirport);
    if (f.arrivalAirport !== "XXX") airports.add(f.arrivalAirport);
  });
  return airports.size;
}

function countUniqueAirlines(flights: Flight[]) {
  const airlines = new Set(flights.map(f => f.airline).filter(a => a !== "Unknown"));
  return airlines.size;
}

export default App;
