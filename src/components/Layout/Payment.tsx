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
  plisioCurrency?: string;
  plisioPsysCid?: string;
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
  const [copied, setCopied] = useState<string | null>(null);
  const wsRef = React.useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const isProduction = process.env.NODE_ENV === "production";

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

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
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

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
      } catch (fallbackErr) {
        console.error("Fallback copy failed:", fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  const downloadQRCode = () => {
    if (!payment?.qrCodeUrl) return;
    
    fetch(payment.qrCodeUrl)
      .then((response) => response.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `qr-code-${payment.orderId}.png`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch((err) => {
        console.error("Failed to download QR code:", err);
        alert("Gagal mengunduh QR code");
      });
  };

  const shareQRCode = async () => {
    if (!payment?.qrCodeUrl) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "QR Code Pembayaran",
          text: `QR Code untuk pembayaran ${payment.orderId}`,
          url: payment.qrCodeUrl,
        });
      } catch (err) {
        console.error("Error sharing:", err);
        copyToClipboard(payment.qrCodeUrl, "qr");
      }
    } else {
      copyToClipboard(payment.qrCodeUrl, "qr");
    }
  };

  const getRemainingTime = (expiryTime?: string): string => {
    if (!expiryTime) return "";
    
    const expiry = new Date(expiryTime).getTime();
    const now = new Date().getTime();
    const diff = expiry - now;
    
    if (diff <= 0) return "00:00:00";
    
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const [countdown, setCountdown] = useState<string>("");

  useEffect(() => {
    if (!payment?.expiryTime || payment.status !== "PENDING") return;
    
    const updateCountdown = () => {
      setCountdown(getRemainingTime(payment.expiryTime));
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [payment?.expiryTime, payment?.status]);

  if (loading) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">Error: {error || "Payment not found"}</div>
      </div>
    );
  }

  const formatExpiryDate = (expiryTime?: string): string => {
    if (!expiryTime) return "";
    const date = new Date(expiryTime);
    const dateStr = date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timeStr = formatTime(expiryTime);
    return `${dateStr}, ${timeStr}`;
  };

  const getPaymentMethodLabel = (method: string): string => {
    const labels: { [key: string]: string } = {
      qris: "QRIS",
      gopay: "GoPay",
      bank_transfer: "Bank Transfer",
      credit_card: "Credit Card",
      crypto: "Crypto",
    };
    return labels[method] || method.toUpperCase();
  };

  const getPaymentMethodLogo = (method: string, bankType?: string, cryptoCurrency?: string): string | null => {
    const baseUrl = "https://simulator.sandbox.midtrans.com/assets/images/payment_partners";
    
    if (method === "qris") {
      return `${baseUrl}/e_wallet/qris.png`;
    }
    
    if (method === "gopay") {
      return `${baseUrl}/e_wallet/gopay.png`;
    }
    
    if (method === "bank_transfer" && bankType) {
      const bankMap: { [key: string]: string } = {
        bca: `${baseUrl}/bank_transfer/bca_va.png`,
        bri: `${baseUrl}/bank_transfer/bri_va.png`,
        bni: `${baseUrl}/bank_transfer/bni_va.png`,
        permata: `${baseUrl}/bank_transfer/permata_va.svg`,
        cimb: `${baseUrl}/bank_transfer/cimb_va.png`,
        danamon: `${baseUrl}/bank_transfer/danamon_va.svg`,
        bsi: `${baseUrl}/bank_transfer/bsi_va.svg`,
        seabank: `${baseUrl}/bank_transfer/seabank_va.svg`,
      };
      return bankMap[bankType.toLowerCase()] || null;
    }
    
    if (method === "crypto" && cryptoCurrency) {
      // Use Plisio icon URL format: https://plisio.net/img/psys-icon/{CID}.svg
      return `https://plisio.net/img/psys-icon/${cryptoCurrency.toUpperCase()}.svg`;
    }
    
    return null;
  };

  return (
    <div className="min-h-screen ">
      {/* Header */}
      <div className=" text-black px-4 py-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold">Payment</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pb-8">

        {/* Payment Deadline & Countdown */}
        {payment.status === "PENDING" && payment.expiryTime && (
          <div className="bg-black text-white px-4 py-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-300">Finish before</span>
                <span className="text-sm font-medium">{formatExpiryDate(payment.expiryTime)}</span>
              </div>
              {countdown && (
                <div className="bg-gray-800 px-3 py-1 rounded-lg">
                  <span className="text-sm font-mono font-semibold">{countdown}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instruction Info */}
        {payment.status === "PENDING" && (payment.paymentMethod === "qris" || payment.paymentMethod === "gopay") && (
          <div className="bg-black text-white px-4 py-2 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-gray-300">
              You can use any supported e-wallet or mobile banking apps
            </span>
          </div>
        )}

        {/* Payment Card */}
        {payment.status === "PENDING" && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-4">

            {/* Card Header with Logos */}
            <div className="px-6 pt-6 pb-4 flex items-center justify-between">
              {(payment.paymentMethod === "qris" || payment.paymentMethod === "gopay") && (
                <>
                  <div className="flex items-center gap-2">
                    {getPaymentMethodLogo(payment.paymentMethod) && (
                      <img
                        src={getPaymentMethodLogo(payment.paymentMethod)!}
                        alt={getPaymentMethodLabel(payment.paymentMethod)}
                        className="h-6 object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    )}
                  </div>
                  {payment.paymentMethod === "qris" && (
                    <div className="text-xs text-gray-500">GPN</div>
                  )}
                </>
              )}
              {payment.paymentMethod === "bank_transfer" && (
                <div className="flex items-center gap-2">
                  {getPaymentMethodLogo(payment.paymentMethod, payment.bankType) && (
                    <img
                      src={getPaymentMethodLogo(payment.paymentMethod, payment.bankType)!}
                      alt={payment.bankType?.toUpperCase() || "Bank"}
                      className="h-6 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                      }}
                    />
                  )}
                </div>
              )}
              {payment.paymentMethod === "crypto" && (
                <div className="flex items-center gap-2">
                  {getPaymentMethodLogo(payment.paymentMethod, undefined, payment.plisioPsysCid || payment.plisioCurrency) && (
                    <img
                      src={getPaymentMethodLogo(payment.paymentMethod, undefined, payment.plisioPsysCid || payment.plisioCurrency)!}
                      alt={payment.plisioPsysCid || payment.plisioCurrency || "Crypto"}
                      className="h-6 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                      }}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Merchant Info */}
            <div className="px-6 pb-4">
              <p className="text-sm font-semibold text-black">{payment.donorName}</p>
              <p className="text-xs text-gray-500 mt-1">Order ID: {payment.orderId}</p>
            </div>

            {/* QR Code or VA Number */}
            {(payment.paymentMethod === "qris" || payment.paymentMethod === "gopay") &&
              payment.qrCodeUrl && (
                <div className="px-6 pb-4 flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={payment.qrCodeUrl}
                    alt="QR Code"
                    className="w-64 h-64 border-2 border-gray-100 rounded-xl"
                  />
                </div>
              )}

            {payment.paymentMethod === "bank_transfer" && payment.vaNumber && (
              <div className="px-6 pb-4">
                <div className="bg-gray-50 py-6 rounded-xl text-center">
                  <p className="text-black font-bold font-mono tracking-wider break-all text-[18px]">
                    {payment.vaNumber}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Bank: {payment.bankType?.toUpperCase()}
                  </p>
                  <button
                    onClick={() => copyToClipboard(payment.vaNumber!, "va")}
                    className="mt-4 px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    {copied === "va" ? "✓ Disalin" : "Salin VA"}
                  </button>
                </div>
              </div>
            )}

            {/* Payment Method & Total */}
            <div className="px-6 pb-4 space-y-3 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getPaymentMethodLogo(payment.paymentMethod, payment.bankType, payment.plisioPsysCid || payment.plisioCurrency) && (
                    <img
                      src={getPaymentMethodLogo(payment.paymentMethod, payment.bankType, payment.plisioPsysCid || payment.plisioCurrency)!}
                      alt={getPaymentMethodLabel(payment.paymentMethod)}
                      className="h-5 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                      }}
                    />
                  )}
                </div>
                <button className="text-sm text-black font-medium hover:underline">
                  Change
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Total</span>
                <span className="text-lg font-bold text-black">{formatAmount(payment.totalAmount || payment.amount)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            {(payment.paymentMethod === "qris" || payment.paymentMethod === "gopay") &&
              payment.qrCodeUrl && (
                <div className="px-6 pb-6 flex gap-3">
                  <button
                    onClick={shareQRCode}
                    className="flex-1 px-4 py-3 bg-gray-100 text-black text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share
                  </button>
                  {isProduction ? (
                    <button
                      onClick={downloadQRCode}
                      className="flex-1 px-4 py-3 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                  ) : (
                    <button
                      onClick={() => copyToClipboard(payment.qrCodeUrl!, "qr")}
                      className="flex-1 px-4 py-3 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                    >
                      {copied === "qr" ? "✓ Disalin" : "📋 Salin URL"}
                    </button>
                  )}
                </div>
              )}
          </div>
        )}

        {/* Payment Instructions Link */}
        {payment.status === "PENDING" && (
          <div className="text-center mb-6">
            <button className="text-black text-sm font-medium hover:underline">
              See payment instruction
            </button>
          </div>
        )}

        {/* Success Screen */}
        {payment.status === "SUCCESS" && (
          <>
            {/* Success Icon & Title */}
            <div className="flex flex-col items-center justify-center py-8 mb-6">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-4">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-black mb-2">Pembayaran Berhasil</h2>
            </div>

            {/* Payment Details Card */}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-4 mt-4">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-500">Tanggal</span>
                  <span className="text-sm font-medium text-black text-right">
                    {new Date(payment.createdAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-500">Waktu</span>
                  <span className="text-sm font-medium text-black text-right font-mono">
                    {formatTime(payment.createdAt)}
                  </span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-500">Metode pembayaran</span>
                  <div className="flex items-center gap-2">
                    {getPaymentMethodLogo(payment.paymentMethod, payment.bankType, payment.plisioPsysCid || payment.plisioCurrency) && (
                      <img
                        src={getPaymentMethodLogo(payment.paymentMethod, payment.bankType, payment.plisioPsysCid || payment.plisioCurrency)!}
                        alt={getPaymentMethodLabel(payment.paymentMethod)}
                        className="h-5 object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-500">Nama Donate</span>
                  <span className="text-sm font-medium text-black text-right">
                    {payment.donorName}
                  </span>
                </div>
                {payment.vaNumber && (
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-gray-500">Nomor VA</span>
                    <span className="text-sm font-medium text-right">
                      {payment.vaNumber}
                    </span>
                  </div>
                )}
                {payment.message && (
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-sm text-gray-500 flex-shrink-0">Catatan</span>
                    <span className="text-sm font-medium text-black text-right flex-1 break-words">
                      {payment.message}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-start pt-3 border-t border-gray-100">
                  <span className="text-sm font-semibold text-gray-700">Total</span>
                  <span className="text-sm font-bold text-black">
                    {formatAmount(payment.totalAmount || payment.amount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 mb-4">
              <button
                onClick={() => router.push("/")}
                className="w-full px-4 py-4 bg-black text-white text-base font-semibold rounded-lg hover:bg-gray-800 transition-colors"
              >
                Selesai
              </button>
              <button
                onClick={shareQRCode}
                className="w-full px-4 py-4 bg-white text-black text-base font-medium rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 border border-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Bagikan
              </button>
            </div>
          </>
        )}

        {/* Failed/Cancelled/Expired Message */}
        {(payment.status === "FAILED" ||
          payment.status === "CANCELLED" ||
          payment.status === "EXPIRED") && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-4">
            <div className="flex flex-col items-center justify-center py-4 mb-4">
              <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mb-4">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-black mb-2">
                Pembayaran {getStatusText(payment.status)}
              </h2>
            </div>
            <p className="text-center text-gray-600 mb-6">
              Pembayaran Anda {getStatusText(payment.status).toLowerCase()}. Silakan coba lagi
              atau hubungi support jika ada pertanyaan.
            </p>
            <button
              onClick={() => router.push("/")}
              className="w-full px-4 py-4 bg-black text-white text-base font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Kembali
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

