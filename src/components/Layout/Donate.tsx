"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
// Simple Chevron Icons
const ChevronDown = ({ className }: { className?: string }) => (
  <svg className={className || "w-4 h-4 text-gray-500"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronUp = ({ className }: { className?: string }) => (
  <svg className={className || "w-4 h-4 text-gray-500"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

interface CreatePaymentRequest {
  donorName: string;
  donorEmail: string;
  amount: number;
  donationType: "gif" | "text";
  mediaUrl?: string;
  mediaType?: string;
  startTime?: number;
  message?: string;
  notes?: string;
  paymentMethod: "bank_transfer" | "gopay" | "qris" | "crypto";
  bank?: string;
  currency?: string;
}

// USD to IDR conversion rate (configurable)
const USD_TO_IDR_RATE = 16500;

// Helper function to get payment method logo URL
const getPaymentMethodLogo = (method: string, cryptoCurrency?: string, bankType?: string): string | null => {
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
      mandiri: `${baseUrl}/bank_transfer/mandiri_va.png`, // Add mandiri if available
    };
    return bankMap[bankType.toLowerCase()] || null;
  }
  
  if (method === "crypto" && cryptoCurrency) {
    // Use Plisio icon URL format: https://plisio.net/img/psys-icon/{CID}.svg
    return `https://plisio.net/img/psys-icon/${cryptoCurrency.toUpperCase()}.svg`;
  }
  
  return null;
};

export default function DonatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [startTimeMinutes, setStartTimeMinutes] = useState<number>(0);
  const [cryptoCurrencies, setCryptoCurrencies] = useState<any[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [showCryptoDialog, setShowCryptoDialog] = useState(false);
  const [minAmountUsd, setMinAmountUsd] = useState<number>(1.0);
  const [usdAmount, setUsdAmount] = useState<string>(""); // For crypto: USD input as string (e.g., "3.12")
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [formData, setFormData] = useState<CreatePaymentRequest>({
    donorName: "",
    donorEmail: "",
    amount: 0,
    donationType: "text",
    message: "",
    notes: "",
    paymentMethod: "qris",
    bank: "bca",
    currency: "",
  });

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  // Reset USD amount when switching payment method
  useEffect(() => {
    if (formData.paymentMethod !== "crypto") {
      setUsdAmount("");
    }
  }, [formData.paymentMethod]);

  // Fetch crypto currencies when crypto payment is selected
  useEffect(() => {
    if (formData.paymentMethod === "crypto" && cryptoCurrencies.length === 0) {
      setLoadingCurrencies(true);
      // Fetch all currencies without sourceCurrency parameter
      fetch(`${apiBaseUrl}/payment/plisio/currencies`)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          if (data.success && data.data) {
            // Show all currencies (don't filter hidden/maintenance)
            setCryptoCurrencies(data.data);
            console.log(`✅ Loaded ${data.data.length} cryptocurrencies`);
          } else {
            console.error("Failed to fetch currencies:", data.error);
          }
        })
        .catch((err) => {
          console.error("Error fetching currencies:", err);
        })
        .finally(() => {
          setLoadingCurrencies(false);
        });
    }
  }, [formData.paymentMethod, apiBaseUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Show confirmation dialog instead of submitting directly
    setShowConfirmDialog(true);
  };

  const handleConfirmPayment = async () => {
    setShowConfirmDialog(false);
    setLoading(true);

    try {
      // Convert startTime from minutes to seconds before sending
      const submitData = {
        ...formData,
        startTime: startTimeMinutes > 0 ? startTimeMinutes * 60 : undefined,
      };

      // Determine which endpoint to use
      const endpoint =
        formData.paymentMethod === "crypto"
          ? `${apiBaseUrl}/payment/plisio/create`
          : `${apiBaseUrl}/payment/create`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (data.success && data.data) {
        // For crypto payments, redirect to invoice_url if available
        if (formData.paymentMethod === "crypto") {
          const invoiceUrl = data.data.invoiceUrl || data.data.invoice?.invoiceUrl;
          if (invoiceUrl) {
            // Redirect directly to Plisio invoice page
            window.location.href = invoiceUrl;
            return;
          }
        }

        // For other payment methods, redirect to payment detail page
        const paymentId =
          data.data.payment?.id ||
          data.data.id ||
          data.data.orderId;
        if (paymentId) {
          router.push(`/${paymentId}`);
        } else {
          alert("Payment created but unable to redirect");
        }
      } else {
        alert("Failed to create payment: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error creating payment:", error);
      alert("Failed to create payment");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    
    // Handle amount input differently for crypto vs non-crypto
    if (name === "amount") {
      if (formData.paymentMethod === "crypto") {
        // For crypto: accept USD with decimal (e.g., "3.12")
        // Allow numbers and one decimal point
        const validUsdInput = value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
        setUsdAmount(validUsdInput);
        
        // Convert USD to cents for backend
        const usdValue = parseFloat(validUsdInput) || 0;
        const amountInCents = Math.round(usdValue * 100);
        setFormData((prev) => ({
          ...prev,
          amount: amountInCents,
        }));
      } else {
        // For non-crypto: integer rupiah
        setFormData((prev) => ({
          ...prev,
          [name]: parseInt(value) || 0,
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };
  
  // Calculate IDR equivalent for crypto donations (for duration calculation)
  const getAmountInIdr = (): number => {
    if (formData.paymentMethod === "crypto") {
      const usdValue = parseFloat(usdAmount) || 0;
      return Math.round(usdValue * USD_TO_IDR_RATE);
    }
    return formData.amount;
  };
  
  // Calculate duration in milliseconds based on IDR amount
  const calculateDuration = (amountIdr: number): number => {
    // 1000 IDR = 10 seconds, so amount / 1000 * 10 * 1000 ms
    const durationMs = (amountIdr / 1000) * 10 * 1000;
    return Math.max(10000, durationMs); // Minimum 10 seconds
  };

  // Format duration from seconds to "X jam X menit X detik"
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours} jam`);
    if (minutes > 0) parts.push(`${minutes} menit`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs} detik`);
    
    return parts.join(" ");
  };

  return (
    <div className="min-h-screen bg-white ">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Buat Donasi</CardTitle>
            <CardDescription>
              Isi formulir di bawah ini untuk membuat donasi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Donor Name */}
              <div className="space-y-2">
                <Label htmlFor="donorName">
                  Nama Donatur <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="donorName"
                  name="donorName"
                  type="text"
                  value={formData.donorName}
                  onChange={handleInputChange}
                  required
                  placeholder="Masukkan nama Anda"
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">
                  Jumlah Donasi{" "}
                  {formData.paymentMethod === "crypto" ? "(USD)" : "(Rp)"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="amount"
                  name="amount"
                  type={formData.paymentMethod === "crypto" ? "text" : "number"}
                  step={formData.paymentMethod === "crypto" ? "0.01" : "1"}
                  value={
                    formData.paymentMethod === "crypto"
                      ? usdAmount
                      : formData.amount || ""
                  }
                  onChange={handleInputChange}
                  required
                  min={
                    formData.paymentMethod === "crypto"
                      ? minAmountUsd.toString()
                      : "1000"
                  }
                  placeholder={
                    formData.paymentMethod === "crypto"
                      ? `3.12 (minimum $${minAmountUsd.toFixed(2)})`
                      : "10000"
                  }
                />
                {formData.paymentMethod !== "crypto" && (
                  <>
                    <div className="flex gap-2 flex-wrap">
                      {[1000, 10000, 20000, 50000].map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({ ...prev, amount }))
                          }
                          className={`px-4 py-2 rounded-lg border-2 transition-all text-sm font-semibold ${
                            formData.amount === amount
                              ? "border-blue-600 bg-blue-50 text-blue-600"
                              : "border-gray-200 bg-white hover:border-gray-300 text-gray-700"
                          }`}
                        >
                          Rp {amount.toLocaleString("id-ID")}
                        </button>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">Minimum Rp 1.000</p>
                  </>
                )}
                {formData.paymentMethod === "crypto" && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Masukkan jumlah dalam USD (contoh: 3.12 untuk $3.12). Akan dikonversi ke cryptocurrency yang dipilih.
                      {formData.currency && (
                        <span className="block mt-1 text-orange-600 font-semibold">
                          Minimum: ${minAmountUsd.toFixed(2)} USD
                        </span>
                      )}
                    </p>
                    {usdAmount && parseFloat(usdAmount) > 0 && (
                      <div className="p-2 bg-blue-50 rounded-lg text-sm">
                        <p className="text-gray-700">
                          <span className="font-semibold">Konversi:</span> ${parseFloat(usdAmount).toFixed(2)} USD
                          {" ≈ "}
                          <span className="font-semibold text-blue-600">
                            Rp {getAmountInIdr().toLocaleString("id-ID")}
                          </span>
                        </p>
                        <p className="text-gray-600 mt-1">
                          Durasi tampil:{" "}
                          <span className="font-semibold">
                            {formatDuration(Math.floor(calculateDuration(getAmountInIdr()) / 1000))}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Donation Type - Toggle Buttons */}
              <div className="space-y-2">
                <Label>
                  Tipe Donasi <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, donationType: "text" }))}
                    className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all ${
                      formData.donationType === "text"
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Text Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, donationType: "gif" }))}
                    className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all ${
                      formData.donationType === "gif"
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Media
                  </button>
                </div>
              </div>

              {/* Media URL (wajib tampil jika Media dipilih) */}
              {formData.donationType === "gif" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="mediaUrl">
                      Media URL <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="mediaUrl"
                      name="mediaUrl"
                      type="url"
                      value={formData.mediaUrl || ""}
                      onChange={handleInputChange}
                      required
                      placeholder="https://example.com/video.mp4 atau YouTube URL"
                    />
                    <p className="text-sm text-muted-foreground">
                      Masukkan URL video, gambar, YouTube, TikTok, atau Instagram Reels
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time (menit, untuk YouTube)</Label>
                    <Input
                      id="startTime"
                      name="startTime"
                      type="number"
                      value={startTimeMinutes || ""}
                      onChange={(e) => {
                        const minutes = parseInt(e.target.value) || 0;
                        setStartTimeMinutes(minutes);
                      }}
                      min="0"
                      placeholder="0"
                    />
                    <p className="text-sm text-muted-foreground">
                      Waktu mulai dalam menit (untuk video YouTube, akan dikonversi ke detik saat submit)
                    </p>
                  </div>
                </>
              )}

              {/* Message - Moved outside Optional Fields */}
              <div className="space-y-2">
                <Label htmlFor="message">
                  Pesan Donasi <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  rows={3}
                  maxLength={250}
                  required
                  placeholder="Pesan untuk donasi Anda (maks 250 karakter)"
                />
                <p className="text-sm text-muted-foreground">
                  {formData.message?.length || 0}/250 karakter
                </p>
              </div>

              {/* Optional Fields Accordion */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowOptional(!showOptional)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-700">
                    Opsi Tambahan {showOptional ? "(Tutup)" : "(Buka)"}
                  </span>
                  {showOptional ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>

                {showOptional && (
                  <div className="p-4 space-y-4 bg-white border-t border-gray-200">
                    {/* Donor Email */}
                    <div className="space-y-2">
                      <Label htmlFor="donorEmail">Email</Label>
                      <Input
                        id="donorEmail"
                        name="donorEmail"
                        type="email"
                        value={formData.donorEmail}
                        onChange={handleInputChange}
                        placeholder="email@example.com"
                      />
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label htmlFor="notes">Catatan</Label>
                      <Textarea
                        id="notes"
                        name="notes"
                        value={formData.notes}
                        onChange={handleInputChange}
                        rows={2}
                        placeholder="Catatan tambahan (opsional)"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Method - Button Grid */}
              <div className="space-y-2">
                <Label>
                  Metode Pembayaran <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {/* Crypto Button */}
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, paymentMethod: "crypto" }))}
                    className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center justify-center ${
                      formData.paymentMethod === "crypto"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <img
                      src={getPaymentMethodLogo("crypto", formData.currency) || "https://plisio.net/img/psys-icon/BTC.svg"}
                      alt="Crypto"
                      className="w-16 h-16 object-contain mb-2"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "https://plisio.net/img/psys-icon/BTC.svg";
                      }}
                    />
                    <span className="text-xs text-gray-500">1%</span>
                  </button>
                  {/* QRIS Button */}
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, paymentMethod: "qris" }))}
                    className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center justify-center ${
                      formData.paymentMethod === "qris"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    {getPaymentMethodLogo("qris") && (
                      <img
                        src={getPaymentMethodLogo("qris")!}
                        alt="QRIS"
                        className=" mb-2"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    )}
                    <span className="text-xs text-gray-500">0.7%</span>
                  </button>

                  {/* GoPay Button */}
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, paymentMethod: "gopay" }))}
                    className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center justify-center ${
                      formData.paymentMethod === "gopay"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    {getPaymentMethodLogo("gopay") && (
                      <img
                        src={getPaymentMethodLogo("gopay")!}
                        alt="GoPay"
                        className="mb-2"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    )}
                    <span className="text-xs text-gray-500">2%</span>
                  </button>

                  {/* Bank Transfer Button */}
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, paymentMethod: "bank_transfer" }))
                    }
                    className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center justify-center ${
                      formData.paymentMethod === "bank_transfer"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    {formData.bank && getPaymentMethodLogo("bank_transfer", undefined, formData.bank) ? (
                      <img
                        key={formData.bank}
                        src={getPaymentMethodLogo("bank_transfer", undefined, formData.bank)!}
                        alt={formData.bank.toUpperCase()}
                        className="mb-2"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-gray-400 to-gray-500 rounded-lg flex items-center justify-center mb-2">
                        <svg
                          className="w-10 h-10 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                          />
                        </svg>
                      </div>
                    )}
                    <span className="text-xs text-gray-500">0%</span>
                  </button>
                </div>
              </div>

              {/* Bank Selection (for bank_transfer) */}
              {formData.paymentMethod === "bank_transfer" && (
                <div className="space-y-2">
                  <Label htmlFor="bank">
                    Pilih Bank <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {["bca", "bni", "cimb", "permata"].map((bank) => (
                      <button
                        key={bank}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, bank }))}
                        className={`px-4 py-2 rounded-lg border-2 transition-all ${
                          formData.bank === bank
                            ? "border-blue-600 bg-blue-50 text-blue-600 font-semibold"
                            : "border-gray-200 bg-white hover:border-gray-300 text-gray-700"
                        }`}
                      >
                        {bank.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Crypto Currency Selection */}
              {formData.paymentMethod === "crypto" && (
                <div className="space-y-2">
                  <div className="space-y-2">
                    <Label htmlFor="currency">
                      Pilih Cryptocurrency (Opsional)
                    </Label>
                    {loadingCurrencies ? (
                      <div className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-500">
                        Memuat cryptocurrency...
                      </div>
                    ) : cryptoCurrencies.length === 0 ? (
                      <div className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-red-500">
                        Gagal memuat cryptocurrency. Silakan coba lagi.
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowCryptoDialog(true)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {formData.currency ? (
                              <>
                                <img
                                  src={
                                    cryptoCurrencies.find((c) => c.cid === formData.currency)
                                      ?.icon || ""
                                  }
                                  alt=""
                                  className="w-8 h-8"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                  }}
                                />
                                <div className="text-left">
                                  <div className="font-semibold text-gray-900">
                                    {
                                      cryptoCurrencies.find((c) => c.cid === formData.currency)
                                        ?.name
                                    }
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {
                                      cryptoCurrencies.find((c) => c.cid === formData.currency)
                                        ?.currency
                                    }
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="text-left">
                                <div className="font-semibold text-gray-900">Auto</div>
                                <div className="text-sm text-gray-500">Plisio akan memilih otomatis</div>
                              </div>
                            )}
                          </div>
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <p className="text-sm text-muted-foreground">
                          Klik untuk memilih cryptocurrency. Total {cryptoCurrencies.length} cryptocurrency tersedia.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? "Memproses..." : "Buat Donasi"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-center">
              Konfirmasi Pembayaran
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-600">
              Silakan periksa detail pembayaran Anda sebelum melanjutkan
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Payment Details Card */}
          <div className="bg-gray-50 rounded-xl p-6 space-y-4 my-4">
            {/* Donor Name */}
            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
              <span className="text-sm text-gray-600">Nama Donatur</span>
              <span className="text-sm font-semibold text-gray-900">{formData.donorName}</span>
            </div>

            {/* Amount */}
            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
              <span className="text-sm text-gray-600">Jumlah Donasi</span>
              <span className="text-lg font-bold text-gray-900">
                {formData.paymentMethod === "crypto" 
                  ? `$${parseFloat(usdAmount || "0").toFixed(2)} USD`
                  : `Rp ${formData.amount.toLocaleString("id-ID")}`
                }
              </span>
            </div>

            {/* Payment Method */}
            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
              <span className="text-sm text-gray-600">Metode Pembayaran</span>
              <div className="flex items-center gap-2">
                {getPaymentMethodLogo(formData.paymentMethod, formData.currency, formData.bank) && (
                  <img
                    src={getPaymentMethodLogo(formData.paymentMethod, formData.currency, formData.bank)!}
                    alt={getPaymentMethodLabel(formData.paymentMethod)}
                    className="h-5 object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                    }}
                  />
                )}
                <span className="text-sm font-semibold text-gray-900">
                  {getPaymentMethodLabel(formData.paymentMethod)}
                </span>
              </div>
            </div>

            {/* Bank Selection (if bank_transfer) */}
            {formData.paymentMethod === "bank_transfer" && formData.bank && (
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-sm text-gray-600">Bank</span>
                <span className="text-sm font-semibold text-gray-900">
                  {formData.bank.toUpperCase()}
                </span>
              </div>
            )}

            {/* Crypto Currency (if crypto) */}
            {formData.paymentMethod === "crypto" && formData.currency && (
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-sm text-gray-600">Cryptocurrency</span>
                <div className="flex items-center gap-2">
                  {getPaymentMethodLogo("crypto", formData.currency) && (
                    <img
                      src={getPaymentMethodLogo("crypto", formData.currency)!}
                      alt="Crypto"
                      className="h-5 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                      }}
                    />
                  )}
                  <span className="text-sm font-semibold text-gray-900">
                    {cryptoCurrencies.find((c) => c.cid === formData.currency)?.name || formData.currency}
                  </span>
                </div>
              </div>
            )}

            {/* Donation Type */}
            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
              <span className="text-sm text-gray-600">Tipe Donasi</span>
              <span className="text-sm font-semibold text-gray-900">
                {formData.donationType === "gif" ? "Media" : "Text Only"}
              </span>
            </div>

            {/* Message */}
            <div className="flex flex-col gap-1 pt-3 border-t border-gray-200">
              <span className="text-sm text-gray-600">Pesan</span>
              <span className="text-sm font-medium text-gray-900 break-words">
                {formData.message || "-"}
              </span>
            </div>

            {/* Media URL (if Media donation type) */}
            {formData.donationType === "gif" && formData.mediaUrl && (
              <div className="flex flex-col gap-1 pt-3 border-t border-gray-200">
                <span className="text-sm text-gray-600">Media URL</span>
                <span className="text-sm font-medium text-gray-900 break-all">
                  {formData.mediaUrl}
                </span>
              </div>
            )}

            {/* Durasi Tampil - for all payment methods */}
            <div className="pt-3 border-t border-gray-300">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">Durasi Tampil</span>
                <span className="text-sm font-bold text-blue-600">
                  {formatDuration(Math.floor(calculateDuration(getAmountInIdr()) / 1000))}
                </span>
              </div>
              {formData.paymentMethod === "crypto" && (
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-500">Setara dengan</span>
                  <span className="text-xs text-gray-500">
                    Rp {getAmountInIdr().toLocaleString("id-ID")}
                  </span>
                </div>
              )}
            </div>
          </div>

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmPayment}
              disabled={loading}
              className="w-full sm:w-auto bg-black hover:bg-gray-800 text-white"
            >
              {loading ? "Memproses..." : "Konfirmasi & Bayar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Crypto Currency Selection Dialog */}
      <AlertDialog open={showCryptoDialog} onOpenChange={setShowCryptoDialog}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold">
              Pilih Cryptocurrency
            </AlertDialogTitle>
            <AlertDialogDescription>
              Pilih cryptocurrency yang ingin Anda gunakan untuk pembayaran
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {/* Auto Option */}
            <button
              type="button"
              onClick={() => {
                setFormData((prev) => ({ ...prev, currency: "" }));
                setShowCryptoDialog(false);
                setMinAmountUsd(1.0);
              }}
              className={`w-full p-4 rounded-lg border-2 transition-all mb-3 text-left ${
                !formData.currency
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Auto</div>
                  <div className="text-sm text-gray-500">Plisio akan memilih otomatis</div>
                </div>
              </div>
            </button>

            {/* Crypto List with Details */}
            <div className="space-y-2">
              {cryptoCurrencies.map((crypto) => {
                const minSumIn = parseFloat(crypto.min_sum_in || "0");
                const fiatRate = parseFloat(crypto.fiat_rate || "0");
                const minUsd = fiatRate > 0 ? (minSumIn / fiatRate) : 0;
                const commission = parseFloat(crypto.invoice_commission_percentage || "0");
                
                return (
                  <button
                    key={crypto.cid}
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, currency: crypto.cid }));
                      setShowCryptoDialog(false);
                      // Calculate minimum USD amount
                      if (crypto.min_sum_in && crypto.fiat_rate) {
                        const minSumIn = parseFloat(crypto.min_sum_in);
                        const fiatRate = parseFloat(crypto.fiat_rate);
                        if (!isNaN(minSumIn) && !isNaN(fiatRate) && fiatRate > 0) {
                          const minUsd = (minSumIn / fiatRate) * 1.1; // Add 10% buffer
                          setMinAmountUsd(minUsd);
                        }
                      }
                    }}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      formData.currency === crypto.cid
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    } ${crypto.hidden || crypto.maintenance ? "opacity-50" : ""}`}
                    disabled={crypto.hidden || crypto.maintenance}
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <img
                        src={crypto.icon}
                        alt={crypto.name}
                        className="w-12 h-12 object-contain flex-shrink-0"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                      
                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`font-semibold ${formData.currency === crypto.cid ? "text-blue-600" : "text-gray-900"}`}>
                            {crypto.name}
                          </div>
                          <div className="text-sm text-gray-500">({crypto.currency})</div>
                          {crypto.hidden && (
                            <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">Hidden</span>
                          )}
                          {crypto.maintenance && (
                            <span className="text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded">Maintenance</span>
                          )}
                        </div>
                        
                        {/* Important Fields - Fee and Min only */}
                        <div className="flex gap-4 mt-2 text-xs">
                          {minUsd > 0 && (
                            <div>
                              <span className="text-gray-500">Min: </span>
                              <span className="font-medium text-gray-900">
                                ${minUsd.toFixed(4)} USD
                              </span>
                            </div>
                          )}
                          {commission > 0 && (
                            <div>
                              <span className="text-gray-500">Fee: </span>
                              <span className="font-medium text-gray-900">
                                {commission}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Selection Indicator */}
                      {formData.currency === crypto.cid && (
                        <div className="flex-shrink-0">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Helper function to get payment method label
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
