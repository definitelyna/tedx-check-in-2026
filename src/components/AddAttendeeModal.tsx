import { useState } from "react";
import { db, type Attendee } from "../lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { X } from "lucide-react";

interface AddAttendeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendees: Attendee[];
  onAttendeeAdded: () => void;
  showNotification: (
    message: string,
    type: "success" | "error" | "warning",
  ) => void;
}

export function AddAttendeeModal({
  isOpen,
  onClose,
  attendees,
  onAttendeeAdded,
  showNotification,
}: AddAttendeeModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [selectedTicketNumber, setSelectedTicketNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Calculate available ticket numbers
  const getAvailableTicketNumbers = () => {
    const usedNumbers = new Set(
      attendees.map((a) => {
        const num = parseInt(
          a.ticket_number?.toString().replace(/\D/g, "") || "0",
        );
        return num;
      }),
    );

    const gaps: number[] = [];

    if (usedNumbers.size === 0) {
      // No attendees, suggest starting at 1
      return { gaps: [1], nextNumber: 1 };
    }

    const maxNumber = Math.max(...Array.from(usedNumbers));

    // Find gaps
    for (let i = 1; i < maxNumber; i++) {
      if (!usedNumbers.has(i)) {
        gaps.push(i);
      }
    }

    const nextNumber = gaps.length > 0 ? gaps[0] : maxNumber + 1;

    return { gaps, nextNumber };
  };

  const { gaps, nextNumber } = getAvailableTicketNumbers();
  const suggestedNumber = gaps.length > 0 ? gaps[0] : nextNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !selectedTicketNumber) {
      showNotification("Please fill in name and ticket number", "error");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      showNotification("Invalid email format", "error");
      return;
    }

    setIsLoading(true);

    try {
      await addDoc(collection(db, "attendees"), {
        name: name.trim(),
        email: email ? email.trim().toLowerCase() : null,
        qr_code: qrCode ? qrCode.trim() : null,
        ticket_number: selectedTicketNumber,
        checked_in: false,
        checked_in_at: null,
      });

      showNotification(`${name} added successfully!`, "success");
      setName("");
      setEmail("");
      setQrCode("");
      setSelectedTicketNumber("");
      onAttendeeAdded();
      onClose();
    } catch (error) {
      console.error("Error adding attendee:", error);
      showNotification("Error adding attendee", "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg border border-red-600 p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Add Attendee</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter full name"
              className="w-full px-4 py-2 bg-gray-800 border border-red-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              className="w-full px-4 py-2 bg-gray-800 border border-red-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              QR Code
            </label>
            <input
              type="text"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              placeholder="Enter QR code"
              className="w-full px-4 py-2 bg-gray-800 border border-red-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Ticket Number *
              {gaps.length > 0 && (
                <span className="text-gray-400 text-xs ml-2">
                  ({gaps.length} gap(s) available)
                </span>
              )}
            </label>
            {gaps.length > 0 ? (
              <select
                value={selectedTicketNumber}
                onChange={(e) => setSelectedTicketNumber(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-red-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                disabled={isLoading}
              >
                <option value="">Select a ticket number</option>
                {gaps.map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                value={selectedTicketNumber}
                onChange={(e) => setSelectedTicketNumber(e.target.value)}
                placeholder={`Next available: ${nextNumber}`}
                defaultValue={nextNumber}
                className="w-full px-4 py-2 bg-gray-800 border border-red-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                disabled={isLoading}
              />
            )}
            <p className="text-xs text-gray-500 mt-1">
              Suggested: {suggestedNumber}
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-red-600 rounded-lg text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? "Adding..." : "Add Attendee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
