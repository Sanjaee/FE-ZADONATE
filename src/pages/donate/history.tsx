"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
  const { data: session, status } = useSession();
  const router = useRouter();
  const [history, setHistory] = useState<DonationHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [limit] = useState<number>(50);
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [clearingQueue, setClearingQueue] = useState<boolean>(false);
  const [clearQueueMessage, setClearQueueMessage] = useState<string | null>(null);
  const [showClearQueueDialog, setShowClearQueueDialog] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  // Check session and redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login?callbackUrl=" + encodeURIComponent("/donate/history"));
    } else if (status === "authenticated") {
      // Check if user is admin
      if (session?.user?.role !== "admin" && session?.userType !== "admin") {
        router.push("/");
      }
    }
  }, [status, session, router]);

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

  const handleClearQueueClick = () => {
    setShowClearQueueDialog(true);
  };

  const clearQueue = async () => {
    setShowClearQueueDialog(false);
    
    try {
      setClearingQueue(true);
      setClearQueueMessage(null);
      setError(null);

      const response = await fetch(`${apiBaseUrl}/hit/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to clear queue: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setClearQueueMessage("Queue cleared successfully");
        // Clear message after 3 seconds
        setTimeout(() => {
          setClearQueueMessage(null);
        }, 3000);
      } else {
        throw new Error(data.error || "Failed to clear queue");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      setClearQueueMessage(null);
      console.error("Error clearing queue:", err);
    } finally {
      setClearingQueue(false);
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

  // Show loading while checking session
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-black mb-8">Donation History</h1>
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-600 text-lg">Checking authentication...</div>
          </div>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (redirect will happen)
  if (status === "unauthenticated" || !session) {
    return null;
  }

  // Don't render if not admin (redirect will happen)
  if (session?.user?.role !== "admin" && session?.userType !== "admin") {
    return null;
  }

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
    <div className="min-h-screen bg-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Donation History</h1>
            <p className="text-sm text-gray-500 mt-1">{history.length} donations</p>
          </div>
          <button
            onClick={handleClearQueueClick}
            disabled={clearingQueue}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear Queue
          </button>
        </div>

        {/* Success/Error Messages */}
        {clearQueueMessage && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-md border border-green-100">
            {clearQueueMessage}
          </div>
        )}
        {error && history.length === 0 && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-100">
            Error: {error}
          </div>
        )}

        {history.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <p className="text-gray-400 text-sm">No donation history found</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((donation) => (
                <div
                  key={donation.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-200"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        donation.type === "gif" 
                          ? "bg-blue-50 text-blue-700" 
                          : "bg-green-50 text-green-700"
                      }`}
                    >
                      {donation.type === "gif" ? "GIF" : "TEXT"}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(
                        donation
                      )} text-white`}
                    >
                      {donation.payment?.paymentMethod === "crypto" 
                        ? "Crypto" 
                        : donation.payment?.paymentMethod 
                          ? donation.payment.paymentMethod.split("_").map((word) => 
                              word.charAt(0).toUpperCase() + word.slice(1)
                            ).join(" ")
                          : "Payment"}
                    </span>
                  </div>
                  
                  {/* Donor Name */}
                  <h3 className="text-base font-semibold text-gray-900 mb-2 truncate">
                    {donation.donorName}
                  </h3>
                  
                  {/* Amount */}
                  <p className="text-lg font-bold text-gray-900 mb-3">
                    {formatAmount(donation.amount)}
                  </p>

                  {/* Message */}
                  {donation.message && donation.message.trim().length > 0 && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {donation.message}
                    </p>
                  )}

                  {/* Media URL (for GIF) */}
                  {donation.type === "gif" && donation.mediaUrl && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <a
                        href={donation.mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-700 hover:underline truncate block"
                        title={donation.mediaUrl}
                      >
                        {donation.mediaUrl.length > 40 
                          ? `${donation.mediaUrl.substring(0, 40)}...` 
                          : donation.mediaUrl}
                      </a>
                    </div>
                  )}

                  {/* Date */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      {formatDate(donation.createdAt)}
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
                  className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Loading..." : "Load More"}
                </button>
              </div>
            )}

            {!hasMore && history.length > 0 && (
              <div className="mt-8 text-center text-gray-400 text-xs">
                No more donations to load
              </div>
            )}
          </>
        )}
      </div>

      {/* Clear Queue Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearQueueDialog}
        onClose={() => setShowClearQueueDialog(false)}
        onConfirm={clearQueue}
        title="Clear Queue"
        description="Are you sure you want to clear all queues and reset state? This action cannot be undone."
        confirmText="Clear Queue"
        cancelText="Cancel"
        variant="destructive"
        isLoading={clearingQueue}
      />
    </div>
  );
}

