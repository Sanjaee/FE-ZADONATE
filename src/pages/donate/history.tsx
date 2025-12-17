"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

interface DonationHistory {
  id: string;
  type: "gif" | "text";
  mediaUrl?: string;
  mediaType?: string;
  startTime?: number;
  donorName: string;
  amount: number;
  message?: string;
  createdAt: string;
  payment?: {
    paymentMethod?: string;
    paymentType?: string;
  };
}

interface HistoryResponse {
  success: boolean;
  data: DonationHistory[];
  limit: number;
  offset: number;
}

interface WebSocketMessage {
  type: string;
  id?: string;
  donorName?: string;
  amount?: number;
  message?: string;
  mediaUrl?: string;
  mediaType?: string;
  startTime?: number;
  createdAt?: string;
  paymentMethod?: string;
  paymentType?: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<DonationHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [limit] = useState<number>(50);
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const fetchHistory = useCallback(async (currentOffset: number) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${apiBaseUrl}/hit/history?limit=${limit}&offset=${currentOffset}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.statusText}`);
      }

      const data: HistoryResponse = await response.json();

      if (data.success) {
        if (currentOffset === 0) {
          setHistory(data.data);
        } else {
          setHistory((prev) => [...prev, ...data.data]);
        }
        setHasMore(data.data.length === limit);
      } else {
        throw new Error("Failed to fetch history");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("Error fetching history:", err);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, limit]);

  useEffect(() => {
    fetchHistory(0);
  }, [fetchHistory]);

  // WebSocket connection for realtime updates
  useEffect(() => {
    const connectWebSocket = () => {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      let wsHost = process.env.NEXT_PUBLIC_WS_HOST || "localhost:5000";
      // Remove protocol if present (http:// or https://)
      wsHost = wsHost.replace(/^https?:\/\//, "");
      const wsUrl = `${wsProtocol}//${wsHost}/ws`;

      try {
        // Close existing connection if any
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log("🔄 Closing existing WebSocket connection before reconnecting");
          wsRef.current.close();
        }

        const ws = new WebSocket(wsUrl);
        console.log("🔌 Attempting WebSocket connection to:", wsUrl);

        ws.onopen = () => {
          console.log("✅ WebSocket connected successfully (history page)");
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const rawData = event.data.toString().trim();
            if (!rawData) return;

            const messages = rawData.includes('\n') 
              ? rawData.split('\n').filter((msg: string) => msg.trim())
              : [rawData];
            
            for (const message of messages) {
              const trimmed = message.trim();
              if (!trimmed) continue;
              
              try {
                const data: WebSocketMessage = JSON.parse(trimmed);

                // Handle new history from WebSocket
                if (data.type === "history" && data.id && data.donorName && data.amount !== undefined) {
                  console.log("📥 Received new history via WebSocket:", data);
                  
                  // Determine type from mediaUrl presence (gif has mediaUrl, text doesn't)
                  const historyType: "gif" | "text" = data.mediaUrl ? "gif" : "text";
                  
                  const newHistory: DonationHistory = {
                    id: data.id,
                    type: historyType,
                    donorName: data.donorName,
                    amount: data.amount,
                    message: data.message || "",
                    mediaUrl: data.mediaUrl,
                    mediaType: data.mediaType,
                    startTime: data.startTime,
                    createdAt: data.createdAt || new Date().toISOString(),
                    payment: data.paymentMethod
                      ? {
                          paymentMethod: data.paymentMethod,
                          paymentType: data.paymentType,
                        }
                      : undefined,
                  };

                  // Add new history to the beginning of the list (most recent first)
                  setHistory((prev) => {
                    // Check if history already exists to avoid duplicates
                    const exists = prev.some((h) => h.id === newHistory.id);
                    if (exists) {
                      console.log("⚠️ History already exists, skipping:", newHistory.id);
                      return prev;
                    }
                    return [newHistory, ...prev];
                  });
                }
              } catch {
                // Skip invalid JSON messages
                console.warn("Invalid JSON message:", trimmed.substring(0, 100));
              }
            }
          } catch (error) {
            console.error("Error processing WebSocket message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("❌ WebSocket error:", error);
        };

        ws.onclose = (event) => {
          console.log("🔌 WebSocket closed:", {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });
          
          // Only reconnect if not manually closed
          if (event.code !== 1000) {
            if (!reconnectTimeoutRef.current) {
              console.log("🔄 Scheduling WebSocket reconnection in 3 seconds...");
              reconnectTimeoutRef.current = setTimeout(() => {
                connectWebSocket();
              }, 3000);
            }
          }
        };

        wsRef.current = ws;
      } catch (error) {
        console.error("❌ WebSocket connection failed:", error);
        // Retry connection after 3 seconds
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("🔄 Retrying WebSocket connection...");
            connectWebSocket();
          }, 3000);
        }
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const loadMore = () => {
    if (!loading && hasMore) {
      const newOffset = offset + limit;
      setOffset(newOffset);
      fetchHistory(newOffset);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatAmount = (amount: number): string => {
    return `Rp${amount.toLocaleString("id-ID")}`;
  };

  const getTypeLabel = (donation: DonationHistory): string => {
    const typeLabel = donation.type === "gif" ? "Media" : "Text";
    const paymentMethod = donation.payment?.paymentMethod;
    
    if (paymentMethod === "crypto") {
      return `${typeLabel} (Crypto)`;
    } else if (paymentMethod) {
      // Format payment method: bank_transfer -> Bank Transfer, gopay -> GoPay, etc.
      const formatted = paymentMethod
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      return `${typeLabel} (${formatted})`;
    }
    return `${typeLabel} Donation`;
  };

  const getTypeColor = (donation: DonationHistory): string => {
    const paymentMethod = donation.payment?.paymentMethod;
    
    if (paymentMethod === "crypto") {
      return donation.type === "gif" ? "bg-yellow-500" : "bg-yellow-600";
    } else if (paymentMethod === "bank_transfer") {
      return donation.type === "gif" ? "bg-gray-500" : "bg-gray-600";
    } else if (paymentMethod === "gopay" || paymentMethod === "qris") {
      return donation.type === "gif" ? "bg-blue-500" : "bg-blue-600";
    } else if (paymentMethod === "credit_card") {
      return donation.type === "gif" ? "bg-purple-500" : "bg-purple-600";
    }
    
    // Default colors
    return donation.type === "gif"
      ? "bg-blue-500"
      : "bg-green-500";
  };

  if (loading && history.length === 0) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-black mb-8">Donation History</h1>
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-600 text-lg">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error && history.length === 0) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-black mb-8">Donation History</h1>
          <div className="flex justify-center items-center h-64">
            <div className="text-red-600 text-lg">Error: {error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-black mb-8">Donation History</h1>

        {history.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500 text-lg">No donation history found</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {history.map((donation) => (
                <div
                  key={donation.id}
                  className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  {/* Header with type badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${getTypeColor(
                        donation
                      )}`}
                    >
                      {getTypeLabel(donation)}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {formatDate(donation.createdAt)}
                    </span>
                  </div>

                  {/* Donor Name */}
                  <div className="mb-3">
                    <h3 className="text-xl font-bold text-black">
                      {donation.donorName}
                    </h3>
                  </div>

                  {/* Amount */}
                  <div className="mb-4">
                    <p className="text-2xl font-semibold text-black">
                      {formatAmount(donation.amount)}
                    </p>
                  </div>

                  {/* Message (if exists) */}
                  {donation.message && donation.message.trim().length > 0 && (
                    <div className="mb-4">
                      <p className="text-gray-700 text-sm line-clamp-3">
                        {donation.message}
                      </p>
                    </div>
                  )}

                  {/* Media Info (for GIF donations, no video display) */}
                  {donation.type === "gif" && donation.mediaType && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-2 text-gray-600 text-sm">
                        <span className="font-semibold">Media Type:</span>
                        <span className="capitalize">{donation.mediaType}</span>
                      </div>
                      {donation.startTime !== undefined && donation.startTime > 0 && (
                        <div className="flex items-center gap-2 text-gray-600 text-sm mt-1">
                          <span className="font-semibold">Start Time:</span>
                          <span>{Math.floor(donation.startTime / 60)}:{(donation.startTime % 60).toString().padStart(2, "0")}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ID (small, for reference) */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-gray-400 text-xs font-mono truncate">
                      ID: {donation.id}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Loading..." : "Load More"}
                </button>
              </div>
            )}

            {!hasMore && history.length > 0 && (
              <div className="mt-8 text-center text-gray-500">
                No more donations to load
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

