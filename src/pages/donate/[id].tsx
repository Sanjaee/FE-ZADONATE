"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";

interface Payment {
  id: string;
  orderId: string;
  donorName: string;
  donorEmail?: string;
  amount: number;
  totalAmount: number;
  status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED";
  paymentMethod: string;
  donationType: "gif" | "text";
  mediaUrl?: string;
  mediaType?: string;
  startTime?: number;
  message?: string;
  notes?: string;
  vaNumber?: string;
  bankType?: string;
  qrCodeUrl?: string;
  expiryTime?: string;
  createdAt: string;
  updatedAt: string;
  history?: {
    id: string;
    type: string;
    donorName: string;
    amount: number;
    message?: string;
  };
}

interface WebSocketMessage {
  type: string;
  paymentId?: string;
  orderId?: string;
  status?: string;
  vaNumber?: string;
  bankType?: string;
  qrCodeUrl?: string;
  expiryTime?: string;
  donorName?: string;
  amount?: number;
  donationType?: string;
  message?: string;
  mediaUrl?: string;
  mediaType?: string;
  startTime?: number;
}

export default function PaymentDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = React.useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const fetchPayment = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/payment/${id}`);

      if (!response.ok) {
        throw new Error("Failed to fetch payment");
      }

      const data = await response.json();
      if (data.success) {
        setPayment(data.data);
      } else {
        throw new Error(data.error || "Failed to fetch payment");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("Error fetching payment:", err);
    } finally {
      setLoading(false);
    }
  }, [id, apiBaseUrl]);

  useEffect(() => {
    fetchPayment();
  }, [fetchPayment]);

  // Poll payment status if still pending
  useEffect(() => {
    if (!payment || payment.status !== "PENDING") return;

    const pollInterval = setInterval(async () => {
      try {
        // Check status from backend (which will check Midtrans API)
        const response = await fetch(`${apiBaseUrl}/payment/check-status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ orderId: payment.orderId }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setPayment(data.data);
            // Stop polling if payment is no longer pending
            if (data.data.status !== "PENDING") {
              clearInterval(pollInterval);
            }
          }
        }
      } catch (error) {
        console.error("Error polling payment status:", error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [payment, apiBaseUrl]);

  // WebSocket connection for realtime payment status updates
  useEffect(() => {
    if (!id || !payment) return;

    const connectWebSocket = () => {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = process.env.NEXT_PUBLIC_WS_HOST || "localhost:5000";
      const wsUrl = `${wsProtocol}//${wsHost}/ws`;

      try {
        // Close existing connection if any
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log("🔄 Closing existing WebSocket connection before reconnecting");
          wsRef.current.close();
        }

        const ws = new WebSocket(wsUrl);
        console.log("🔌 Attempting WebSocket connection for payment status:", wsUrl);

        ws.onopen = () => {
          console.log("✅ WebSocket connected successfully (payment status)");
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

                // Handle payment status update (match by order ID or payment ID)
                if (data.type === "payment_status") {
                  const matchesOrderId = data.orderId && data.orderId === id;
                  const matchesPaymentId = data.paymentId && payment && payment.id === data.paymentId;
                  
                  if (matchesOrderId || matchesPaymentId) {
                    console.log("📥 Received payment status update via WebSocket:", data);
                    
                    setPayment((prev) => {
                      if (!prev) return prev;
                      
                      return {
                        ...prev,
                        status: data.status as Payment["status"],
                        vaNumber: data.vaNumber || prev.vaNumber,
                        bankType: data.bankType || prev.bankType,
                        qrCodeUrl: data.qrCodeUrl || prev.qrCodeUrl,
                        expiryTime: data.expiryTime || prev.expiryTime,
                      };
                    });
                  }
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
          
          // Only reconnect if not manually closed and payment is still pending
          if (event.code !== 1000 && payment?.status === "PENDING") {
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
        // Retry connection after 3 seconds if payment is pending
        if (payment?.status === "PENDING" && !reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("🔄 Retrying WebSocket connection...");
            connectWebSocket();
          }, 3000);
        }
      }
    };

    // Only connect WebSocket if payment is pending
    if (payment && payment.status === "PENDING") {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, payment?.status]);

  const formatAmount = (amount: number): string => {
    return `Rp${amount.toLocaleString("id-ID")}`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "SUCCESS":
        return "bg-green-500";
      case "PENDING":
        return "bg-yellow-500";
      case "FAILED":
      case "CANCELLED":
      case "EXPIRED":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case "SUCCESS":
        return "Berhasil";
      case "PENDING":
        return "Menunggu Pembayaran";
      case "FAILED":
        return "Gagal";
      case "CANCELLED":
        return "Dibatalkan";
      case "EXPIRED":
        return "Kedaluwarsa";
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-8 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen bg-white p-8 flex items-center justify-center">
        <div className="text-red-600">Error: {error || "Payment not found"}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-black mb-8">Detail Pembayaran</h1>

        {/* Status Badge */}
        <div className="mb-6">
          <span
            className={`px-4 py-2 rounded-full text-white font-semibold ${getStatusColor(
              payment.status
            )}`}
          >
            {getStatusText(payment.status)}
          </span>
        </div>

        {/* Payment Info */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-black mb-4">Informasi Donasi</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Nama Donatur:</span>
              <span className="font-semibold text-black">{payment.donorName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Jumlah:</span>
              <span className="font-semibold text-black">{formatAmount(payment.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tipe Donasi:</span>
              <span className="font-semibold text-black capitalize">
                {payment.donationType}
              </span>
            </div>
            {payment.message && (
              <div>
                <span className="text-gray-600">Pesan:</span>
                <p className="text-black mt-1">{payment.message}</p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Instructions */}
        {payment.status === "PENDING" && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-black mb-4">Instruksi Pembayaran</h2>

            {payment.paymentMethod === "bank_transfer" && payment.vaNumber && (
              <div className="space-y-4">
                <div>
                  <p className="text-gray-600 mb-2">Transfer ke Virtual Account:</p>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-2xl font-bold text-black font-mono">
                      {payment.vaNumber}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Bank: {payment.bankType?.toUpperCase()}
                    </p>
                  </div>
                </div>
                {payment.expiryTime && (
                  <div>
                    <p className="text-sm text-gray-600">
                      Berlaku hingga: {new Date(payment.expiryTime).toLocaleString("id-ID")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {(payment.paymentMethod === "gopay" || payment.paymentMethod === "qris") &&
              payment.qrCodeUrl && (
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-600 mb-4">
                      {payment.paymentMethod === "qris"
                        ? "Scan QR Code dengan aplikasi pembayaran Anda:"
                        : "Scan QR Code dengan GoPay:"}
                    </p>
                    <div className="flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={payment.qrCodeUrl}
                        alt="QR Code"
                        className="w-64 h-64 border border-gray-200 rounded-lg"
                      />
                    </div>
                  </div>
                  {payment.expiryTime && (
                    <div>
                      <p className="text-sm text-gray-600 text-center">
                        Berlaku hingga: {new Date(payment.expiryTime).toLocaleString("id-ID")}
                      </p>
                    </div>
                  )}
                </div>
              )}

            {payment.paymentMethod === "credit_card" && (
              <div>
                <p className="text-gray-600">
                  Silakan selesaikan pembayaran dengan kartu kredit Anda.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Success Message */}
        {payment.status === "SUCCESS" && payment.history && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-green-800 mb-2">✅ Pembayaran Berhasil!</h2>
            <p className="text-green-700">
              Donasi Anda telah berhasil diproses. Terima kasih atas donasi Anda!
            </p>
            {payment.donationType === "gif" && (
              <p className="text-green-700 mt-2">
                Media donasi akan ditampilkan sesuai dengan tipe yang Anda pilih.
              </p>
            )}
            {payment.donationType === "text" && (
              <p className="text-green-700 mt-2">
                Donasi teks akan ditampilkan sesuai dengan pesan yang Anda berikan.
              </p>
            )}
          </div>
        )}

        {/* Failed/Cancelled/Expired Message */}
        {(payment.status === "FAILED" ||
          payment.status === "CANCELLED" ||
          payment.status === "EXPIRED") && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-red-800 mb-2">
              Pembayaran {getStatusText(payment.status)}
            </h2>
            <p className="text-red-700">
              Pembayaran Anda {getStatusText(payment.status).toLowerCase()}. Silakan coba lagi
              atau hubungi support jika ada pertanyaan.
            </p>
          </div>
        )}

        {/* Order Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-black mb-4">Informasi Order</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Order ID:</span>
              <span className="font-mono text-black">{payment.orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Metode Pembayaran:</span>
              <span className="text-black capitalize">
                {payment.paymentMethod.replace("_", " ")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Dibuat:</span>
              <span className="text-black">
                {new Date(payment.createdAt).toLocaleString("id-ID")}
              </span>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-6">
          <button
            onClick={() => router.push("/donate")}
            className="px-6 py-3 bg-gray-200 text-black font-semibold rounded-lg hover:bg-gray-300 transition-colors"
          >
            Kembali ke Form Donasi
          </button>
        </div>
      </div>
    </div>
  );
}

