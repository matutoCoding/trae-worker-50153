import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from '@/components/Layout/Navbar';
import Home from '@/pages/Home';
import Schedule from '@/pages/Schedule';
import Bookings from '@/pages/Bookings';
import Family from '@/pages/Family';
import Statistics from '@/pages/Statistics';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#FAF8F5]">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/family" element={<Family />} />
            <Route path="/statistics" element={<Statistics />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
