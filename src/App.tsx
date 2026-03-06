import { useState, useEffect, FormEvent } from "react";
import { Car, ShieldCheck, ShieldAlert, RefreshCcw, User, Settings, Clock, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Slot {
  _id: string;
  slot_no: string;
  status: "Available" | "Occupied";
  reservation?: Reservation | null;
}

interface Reservation {
  _id: string;
  slot_no: string;
  start_time: string;
  end_time?: string;
  status: "Active" | "Completed";
}

export default function App() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [history, setHistory] = useState<Reservation[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [filter, setFilter] = useState<"All" | "Available" | "Occupied">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Notification cleanup
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotify = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
  };

  // Demo Mode Data (Local Storage)
  const getDemoSlots = () => {
    const saved = localStorage.getItem('demo_slots');
    if (saved) return JSON.parse(saved);
    return Array.from({ length: 10 }, (_, i) => ({
      _id: `demo-${i + 1}`,
      slot_no: `A${i + 1}`,
      status: "Available",
      reservation: null
    }));
  };

  const getDemoHistory = () => {
    const saved = localStorage.getItem('demo_history');
    return saved ? JSON.parse(saved) : [];
  };

  const saveDemoData = (newSlots: Slot[], newHistory: Reservation[]) => {
    localStorage.setItem('demo_slots', JSON.stringify(newSlots));
    localStorage.setItem('demo_history', JSON.stringify(newHistory));
  };

  const fetchSlots = async () => {
    try {
      const response = await fetch("/api/slots");
      if (!response.ok) throw new Error("API Error");
      const data = await response.json();
      setSlots(data);
      setIsDemoMode(false);
    } catch (err) {
      console.warn("API failed, switching to Demo Mode");
      setSlots(getDemoSlots());
      setIsDemoMode(true);
    }
  };

  const fetchReservations = async () => {
    if (!isAdmin) return;
    if (isDemoMode) {
      const currentSlots = getDemoSlots();
      const active = currentSlots
        .filter((s: Slot) => s.status === "Occupied" && s.reservation)
        .map((s: Slot) => s.reservation);
      setReservations(active);
      setHistory(getDemoHistory());
      return;
    }
    try {
      const response = await fetch("/api/admin/reservations");
      if (!response.ok) throw new Error("API Error");
      const data = await response.json();
      setReservations(data);
      
      const historyResponse = await fetch("/api/admin/history");
      const historyData = await historyResponse.json();
      setHistory(historyData);
    } catch (err) {
      setError("Failed to fetch reservations");
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchSlots();
      if (isAdmin) await fetchReservations();
      setLoading(false);
    };
    init();
  }, [isAdmin]);

  const handleReserve = async (id: string) => {
    if (isDemoMode) {
      const currentSlots = [...slots];
      const slotIndex = currentSlots.findIndex(s => s._id === id);
      if (slotIndex !== -1) {
        const slot_no = currentSlots[slotIndex].slot_no;
        const newReservation: Reservation = {
          _id: Math.random().toString(36).substr(2, 9),
          slot_no,
          start_time: new Date().toISOString(),
          status: "Active"
        };
        currentSlots[slotIndex].status = "Occupied";
        currentSlots[slotIndex].reservation = newReservation;
        setSlots(currentSlots);
        saveDemoData(currentSlots, getDemoHistory());
        showNotify(`Slot ${slot_no} reserved successfully!`);
        setSelectedSlot(null);
        if (isAdmin) fetchReservations();
      }
      return;
    }
    try {
      const response = await fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error("Reservation failed");
      const slot = slots.find(s => s._id === id);
      showNotify(`Slot ${slot?.slot_no} reserved successfully!`);
      setSelectedSlot(null);
      await fetchSlots();
      if (isAdmin) await fetchReservations();
    } catch (err: any) {
      showNotify(err.message, "error");
    }
  };

  const handleRelease = async (id: string) => {
    if (isDemoMode) {
      const currentSlots = [...slots];
      const slotIndex = currentSlots.findIndex(s => s._id === id);
      if (slotIndex !== -1) {
        const res = currentSlots[slotIndex].reservation;
        if (res) {
          const completedRes: Reservation = {
            ...res,
            end_time: new Date().toISOString(),
            status: "Completed"
          };
          const newHistory = [completedRes, ...getDemoHistory()];
          currentSlots[slotIndex].status = "Available";
          currentSlots[slotIndex].reservation = null;
          setSlots(currentSlots);
          setHistory(newHistory);
          saveDemoData(currentSlots, newHistory);
          showNotify(`Slot ${currentSlots[slotIndex].slot_no} released.`);
          setSelectedSlot(null);
          if (isAdmin) fetchReservations();
        }
      }
      return;
    }
    try {
      const response = await fetch("/api/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error("Release failed");
      showNotify("Slot released successfully!");
      setSelectedSlot(null);
      await fetchSlots();
      if (isAdmin) await fetchReservations();
    } catch (err: any) {
      showNotify(err.message, "error");
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Are you sure you want to reset the entire system? This will clear all history and reservations.")) return;
    
    if (isDemoMode) {
      localStorage.removeItem('demo_slots');
      localStorage.removeItem('demo_history');
      window.location.reload();
      return;
    }

    try {
      const response = await fetch("/api/admin/reset", { method: "POST" });
      if (!response.ok) throw new Error("Reset failed");
      showNotify("System reset successfully!");
      await fetchSlots();
      await fetchReservations();
    } catch (err: any) {
      showNotify(err.message, "error");
    }
  };
  const filteredSlots = slots.filter(slot => {
    const matchesFilter = filter === "All" || slot.status === filter;
    const matchesSearch = slot.slot_no.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: slots.length,
    available: slots.filter(s => s.status === "Available").length,
    occupied: slots.filter(s => s.status === "Occupied").length,
    occupancyRate: slots.length > 0 ? Math.round((slots.filter(s => s.status === "Occupied").length / slots.length) * 100) : 0
  };

  if (loading && slots.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <RefreshCcw className="animate-spin text-zinc-400" size={32} />
      </div>
    );
  }

  const handleAdminToggle = () => {
    if (isAdmin) {
      setIsAdmin(false);
      setIsAuthorized(false);
    } else {
      setShowLogin(true);
    }
  };

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    if (passwordInput === "#1Pklipl") {
      setIsAdmin(true);
      setIsAuthorized(true);
      setShowLogin(false);
      setPasswordInput("");
    } else {
      alert("Incorrect password");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 border ${
              notification.type === "success" 
                ? "bg-white border-emerald-100 text-emerald-700" 
                : "bg-white border-rose-100 text-rose-700"
            }`}
          >
            {notification.type === "success" ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
            <span className="text-sm font-medium">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <AnimatePresence>
        {showLogin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full border border-zinc-200"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="bg-zinc-100 p-4 rounded-2xl">
                  <ShieldAlert className="text-zinc-900" size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Admin Access</h3>
                  <p className="text-sm text-zinc-500 mt-1">Please enter the administrator password to continue.</p>
                </div>
                <form onSubmit={handleLogin} className="w-full space-y-4 mt-2">
                  <input
                    type="password"
                    autoFocus
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowLogin(false);
                        setPasswordInput("");
                      }}
                      className="flex-1 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 text-sm font-medium bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors shadow-lg"
                    >
                      Unlock
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-zinc-200">
              <Clock size={20} className="animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Zenith System</h1>
              <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {isDemoMode && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                Demo Mode
              </div>
            )}
            <button
              onClick={handleAdminToggle}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isAdmin 
                  ? "bg-zinc-900 text-white shadow-lg" 
                  : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {isAdmin ? <Settings size={16} /> : <User size={16} />}
              {isAdmin ? "Admin View" : "User View"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Slots Grid */}
          <div className="lg:col-span-2 space-y-8">
            {/* Stats Bento Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-sm">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Slots</div>
                <div className="text-2xl font-bold">{stats.total}</div>
              </div>
              <div className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-sm">
                <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Available</div>
                <div className="text-2xl font-bold text-emerald-600">{stats.available}</div>
              </div>
              <div className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-sm">
                <div className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1">Occupied</div>
                <div className="text-2xl font-bold text-rose-600">{stats.occupied}</div>
              </div>
              <div className="bg-zinc-900 p-4 rounded-3xl shadow-lg shadow-zinc-200 text-white">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Occupancy</div>
                <div className="text-2xl font-bold">{stats.occupancyRate}%</div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-3xl border border-zinc-200 shadow-sm">
              <div className="flex bg-zinc-100 p-1 rounded-2xl w-full sm:w-auto">
                {(["All", "Available", "Occupied"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      filter === t ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-64">
                <Settings className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                <input 
                  type="text"
                  placeholder="Search slot..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-100 border-none rounded-2xl text-xs focus:ring-2 focus:ring-zinc-900 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredSlots.map((slot, index) => (
                  <motion.div
                    layout
                    key={slot._id || `slot-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => {
                      setSelectedSlot(slot);
                    }}
                    className={`relative group h-40 rounded-[2rem] border-2 cursor-pointer transition-all duration-500 overflow-hidden ${
                      selectedSlot?._id === slot._id 
                        ? "ring-4 ring-zinc-900/10 border-zinc-900 shadow-2xl -translate-y-2 z-10" 
                        : "border-zinc-200 hover:border-zinc-400"
                    } ${
                      slot.status === "Available" 
                        ? "bg-white" 
                        : "bg-zinc-100 opacity-90"
                    }`}
                  >
                    {/* Slot Number Label */}
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${slot.status === "Available" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                        {slot.slot_no}
                      </span>
                    </div>

                    {/* Visual Indicator */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`transition-all duration-500 transform ${
                        selectedSlot?._id === slot._id ? "scale-125" : "group-hover:scale-110"
                      } ${
                        slot.status === "Available" ? "text-emerald-500/20" : "text-zinc-300"
                      }`}>
                        <Car size={80} strokeWidth={1} />
                      </div>
                    </div>

                    {/* Status Overlay */}
                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                      <div>
                        <div className={`text-[10px] font-bold uppercase tracking-wider ${
                          slot.status === "Available" ? "text-emerald-600" : "text-zinc-500"
                        }`}>
                          {slot.status}
                        </div>
                        {slot.reservation && (
                          <div className="text-[8px] text-zinc-400 font-mono mt-0.5">
                            {new Date(slot.reservation.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                      <div className={`p-2 rounded-xl ${
                        slot.status === "Available" ? "bg-emerald-50 text-emerald-600" : "bg-zinc-200 text-zinc-400"
                      }`}>
                        {slot.status === "Available" ? <ShieldCheck size={16} /> : <Clock size={16} />}
                      </div>
                    </div>

                    {/* Selection Glow */}
                    {selectedSlot?._id === slot._id && (
                      <motion.div 
                        layoutId="selection-glow"
                        className="absolute inset-0 bg-zinc-900/5 pointer-events-none"
                      />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Admin Reservations Panel */}
          {isAdmin && (
            <div className="lg:col-span-1 space-y-6">
              <h2 className="text-lg font-medium flex items-center gap-2">
                Active Reservations
                <ShieldCheck className="text-emerald-500" size={18} />
              </h2>
              
              <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                {reservations.length === 0 ? (
                  <div className="p-12 flex flex-col items-center justify-center text-zinc-400 gap-2">
                    <Clock size={32} />
                    <p className="text-sm">No active bookings</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {reservations.map((res) => (
                      <div key={res._id} className="p-4 hover:bg-zinc-50 transition-colors group">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-zinc-900">Slot {res.slot_no}</span>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                            Active
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <Clock size={12} />
                            {new Date(res.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <button
                            onClick={() => {
                              const slot = slots.find(s => s.slot_no === res.slot_no);
                              if (slot) handleRelease(slot._id);
                            }}
                            className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Release Slot"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-zinc-900 p-4 rounded-2xl text-white">
                <div className="flex items-center gap-3 mb-2">
                  <ShieldAlert className="text-amber-400" size={20} />
                  <span className="text-sm font-medium">Admin Control</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  You have full authority to release any occupied slot. Releasing a slot will mark the reservation as completed and make the spot available for new users.
                </p>
              </div>

              {/* History Section */}
              <h2 className="text-lg font-medium flex items-center gap-2 pt-4">
                Recent History
                <Clock className="text-zinc-400" size={18} />
              </h2>
              <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                {history.length === 0 ? (
                  <div className="p-8 text-center text-zinc-400 text-xs">No history yet</div>
                ) : (
                  <div className="divide-y divide-zinc-100 max-h-64 overflow-y-auto">
                    {history.map((res) => (
                      <div key={res._id} className="p-3 text-xs">
                        <div className="flex justify-between mb-1">
                          <span className="font-bold">Slot {res.slot_no}</span>
                          <span className="text-zinc-400">Completed</span>
                        </div>
                        <div className="flex flex-col gap-0.5 text-zinc-500">
                          <div className="flex items-center gap-1">
                            <span className="w-12">Start:</span>
                            {new Date(res.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-12">End:</span>
                            {res.end_time ? new Date(res.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Deployment Help */}
              {isDemoMode && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                  <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider mb-2">
                    <Settings size={14} />
                    Live Connection Help
                  </div>
                  <p className="text-xs text-amber-600 leading-relaxed">
                    The app is currently in <strong>Demo Mode</strong> because it couldn't connect to the database. To fix this on Netlify:
                  </p>
                  <ul className="mt-2 space-y-1 text-[10px] text-amber-600 list-disc list-inside">
                    <li>Add <strong>MONGODB_URI</strong> to Netlify Env Variables.</li>
                    <li>In MongoDB Atlas, allow access from <strong>0.0.0.0/0</strong>.</li>
                    <li>Or deploy to <strong>Render.com</strong> for better Node.js support.</li>
                  </ul>
                </div>
              )}

              <button
                onClick={handleReset}
                className="w-full py-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl text-xs font-bold hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={14} />
                Reset Entire System
              </button>
            </div>
          )}

          {/* User Info Panel (when not admin) */}
          {!isAdmin && (
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-emerald-600 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-xl font-bold mb-2">Instant Parking</h3>
                  <p className="text-emerald-100 text-sm mb-6">
                    Find a free spot and click reserve. No forms, no waiting.
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl">
                      <Clock size={24} />
                    </div>
                    <div>
                      <div className="text-xs text-emerald-200 uppercase tracking-widest font-bold">Status</div>
                      <div className="text-lg font-semibold">Ready to Book</div>
                    </div>
                  </div>
                </div>
                <div className="absolute -right-8 -bottom-8 opacity-10">
                  <ShieldCheck size={160} />
                </div>
              </div>

              <div className="bg-white border border-zinc-200 p-6 rounded-3xl">
                <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">How it works</h4>
                <ul className="space-y-4">
                  {[
                    { step: "01", text: "Locate an available slot (green)" },
                    { step: "02", text: "Click the 'Reserve' button" },
                    { step: "03", text: "Your spot is secured instantly" }
                  ].map((item) => (
                    <li key={item.step} className="flex gap-4">
                      <span className="text-emerald-500 font-mono font-bold">{item.step}</span>
                      <span className="text-sm text-zinc-600">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

        </div>
      </main>
      {/* Slot Selection Modal */}
      <AnimatePresence>
        {selectedSlot && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl max-w-md w-full border border-zinc-200"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-zinc-900">Slot {selectedSlot.slot_no}</h3>
                  <p className="text-sm text-zinc-500">Detailed information and actions</p>
                </div>
                <button 
                  onClick={() => setSelectedSlot(null)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <RefreshCcw size={20} className="rotate-45" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Status</div>
                    <div className={`text-sm font-bold ${selectedSlot.status === "Available" ? "text-emerald-600" : "text-rose-600"}`}>
                      {selectedSlot.status}
                    </div>
                  </div>
                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Location</div>
                    <div className="text-sm font-bold text-zinc-900">Main Level</div>
                  </div>
                </div>

                {selectedSlot.reservation && (
                  <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl">
                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-[10px] uppercase tracking-widest mb-2">
                      <Clock size={14} />
                      Active Session
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-emerald-600">Started at</span>
                      <span className="text-sm font-bold text-emerald-700">
                        {new Date(selectedSlot.reservation.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  {selectedSlot.status === "Available" ? (
                    <button
                      onClick={() => handleReserve(selectedSlot._id)}
                      className="w-full py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200 active:scale-[0.98]"
                    >
                      Confirm Reservation
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRelease(selectedSlot._id)}
                      className="w-full py-4 bg-rose-500 text-white font-bold rounded-2xl hover:bg-rose-600 transition-all shadow-xl shadow-rose-100 active:scale-[0.98]"
                    >
                      {isAdmin ? "End Reservation (Admin)" : "Cancel Reservation"}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
