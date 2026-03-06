import { useEffect, useState, useRef } from "react";
import { db, type Attendee } from "./lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  getDocs,
  where,
  updateDoc,
  doc,
} from "firebase/firestore";
import { Search, Clock } from "lucide-react";
import { CSVUpload } from "./components/CSVUpload";

function App() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [qrBuffer, setQrBuffer] = useState("");
  const [lastScanTime, setLastScanTime] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const attendeesRef = collection(db, "attendees");
    const q = query(attendeesRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const attendeeData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Attendee[];

      // Sort by ticket number as numeric value
      attendeeData.sort((a, b) => {
        const ticketA = a.ticket_number?.toString() || "";
        const ticketB = b.ticket_number?.toString() || "";
        const numA = parseInt(ticketA.replace(/\D/g, "")) || 0;
        const numB = parseInt(ticketB.replace(/\D/g, "")) || 0;
        return numA - numB;
      });

      setAttendees(attendeeData);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (qrInputRef.current) {
      qrInputRef.current.focus();
    }
  }, []);

  const handleCheckIn = async (qrCode: string) => {
    try {
      const attendeesRef = collection(db, "attendees");
      const q = query(attendeesRef, where("qr_code", "==", qrCode));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        showNotification("Attendee not found", "error");
        return;
      }

      const attendeeDoc = snapshot.docs[0];
      const attendee = {
        id: attendeeDoc.id,
        ...attendeeDoc.data(),
      } as Attendee;

      if (attendee.checked_in) {
        showNotification(`${attendee.name} already checked in`, "warning");
        return;
      }

      await updateDoc(doc(db, "attendees", attendeeDoc.id), {
        checked_in: true,
        checked_in_at: new Date().toISOString(),
      });

      showNotification(`${attendee.name} checked in successfully!`, "success");
    } catch (error) {
      console.error("Error processing check-in:", error);
      showNotification("Error processing check-in", "error");
    }
  };

  const showNotification = (
    message: string,
    type: "success" | "error" | "warning",
  ) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const toggleCheckIn = async (attendee: Attendee) => {
    try {
      await updateDoc(doc(db, "attendees", attendee.id), {
        checked_in: !attendee.checked_in,
        checked_in_at: !attendee.checked_in ? new Date().toISOString() : null,
      });

      showNotification(
        !attendee.checked_in
          ? `${attendee.name} checked in successfully!`
          : `${attendee.name} check-in removed`,
        "success",
      );
    } catch (error) {
      console.error("Error updating check-in:", error);
      showNotification("Error updating status", "error");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const currentTime = Date.now();

    if (e.key === "Enter") {
      if (qrBuffer.trim()) {
        handleCheckIn(qrBuffer.trim());
        setQrBuffer("");
      }
      setLastScanTime(currentTime);
      return;
    }

    if (currentTime - lastScanTime > 100) {
      setQrBuffer("");
    }

    setQrBuffer((prev) => prev + e.key);
    setLastScanTime(currentTime);
  };

  const filteredAttendees = attendees.filter((attendee) => {
    const query = searchQuery.toLowerCase();
    return (
      attendee.name.toLowerCase().includes(query) ||
      attendee.email.toLowerCase().includes(query)
    );
  });

  const checkedInCount = attendees.filter((a) => a.checked_in).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900">
      <input
        ref={qrInputRef}
        type="text"
        value={qrBuffer}
        onChange={() => {}}
        onKeyPress={handleKeyPress}
        className="absolute opacity-0 pointer-events-none"
        aria-label="QR Scanner Input"
      />

      {notification && (
        <div
          className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse ${
            notification.includes("successfully")
              ? "bg-red-600"
              : notification.includes("removed")
                ? "bg-gray-700"
                : "bg-red-700"
          } text-white font-medium`}
        >
          {notification}
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        <div className="bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-red-600">
          <div className="bg-gradient-to-r from-black to-red-950 px-8 py-8 border-b border-red-600">
            <h1 className="text-4xl font-bold text-white mb-3">
              TEDxISPH 2026 Event Check-in
            </h1>
            <div className="flex items-center gap-6 text-red-100">
              <span className="flex items-center gap-2 text-lg">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                {checkedInCount} Checked In
              </span>
              <span className="flex items-center gap-2 text-lg">
                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                {attendees.length - checkedInCount} Pending
              </span>
              <span className="text-lg font-semibold text-gray-300">
                Total: {attendees.length}
              </span>
            </div>
          </div>

          <div className="p-8">
            <CSVUpload />

            <div className="mb-8 relative mt-8">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-red-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-red-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-800 border-b border-red-600">
                    <th className="px-6 py-4 text-left text-xs font-bold text-red-400 uppercase tracking-wider">
                      Checked In
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-red-400 uppercase tracking-wider">
                      Ticket Number
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-red-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-red-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-red-400 uppercase tracking-wider">
                      Check-in Time
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-900 divide-y divide-gray-800">
                  {filteredAttendees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        {searchQuery
                          ? "No attendees found matching your search"
                          : "No attendees yet"}
                      </td>
                    </tr>
                  ) : (
                    filteredAttendees.map((attendee) => (
                      <tr
                        key={attendee.id}
                        className="hover:bg-gray-800 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={attendee.checked_in}
                            onChange={() => toggleCheckIn(attendee)}
                            className="w-5 h-5 rounded cursor-pointer accent-red-600"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-400">
                            {attendee.ticket_number}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div
                            className={`text-sm font-medium ${attendee.checked_in ? "text-red-400" : "text-gray-300"}`}
                          >
                            {attendee.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-400">
                            {attendee.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {attendee.checked_in_at ? (
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <Clock className="w-4 h-4 text-red-500" />
                              {new Date(
                                attendee.checked_in_at,
                              ).toLocaleString()}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-400">
          <p>
            Scan QR codes to check in attendees, or click the checkbox to
            manually mark attendance.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
