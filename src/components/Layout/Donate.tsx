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
  paymentMethod: "bank_transfer" | "gopay" | "credit_card" | "qris" | "crypto";
  bank?: string;
  currency?: string;
}

// USD to IDR conversion rate (configurable)
const USD_TO_IDR_RATE = 16500;

export default function DonatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [startTimeMinutes, setStartTimeMinutes] = useState<number>(0);
  const [cryptoCurrencies, setCryptoCurrencies] = useState<any[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [showCryptoDropdown, setShowCryptoDropdown] = useState(false);
  const [minAmountUsd, setMinAmountUsd] = useState<number>(1.0);
  const [usdAmount, setUsdAmount] = useState<string>(""); // For crypto: USD input as string (e.g., "3.12")
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

  return (
    <div className="min-h-screen bg-white p-8">
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
                            {(calculateDuration(getAmountInIdr()) / 1000).toFixed(0)} detik
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

                    {/* Message */}
                    <div className="space-y-2">
                      <Label htmlFor="message">Pesan Donasi</Label>
                      <Textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleInputChange}
                        rows={3}
                        maxLength={250}
                        placeholder="Pesan untuk donasi Anda (maks 250 karakter)"
                      />
                      <p className="text-sm text-muted-foreground">
                        {formData.message?.length || 0}/250 karakter
                      </p>
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
                    <div className="w-12 h-12 mb-2 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        formData.paymentMethod === "crypto" ? "text-blue-600" : "text-gray-700"
                      }`}
                    >
                      Crypto
                    </span>
                    <span className="text-xs text-gray-500 mt-1">1%</span>
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
                    <div className="w-12 h-12 mb-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                        />
                      </svg>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        formData.paymentMethod === "qris" ? "text-blue-600" : "text-gray-700"
                      }`}
                    >
                      QRIS
                    </span>
                    <span className="text-xs text-gray-500 mt-1">0.7%</span>
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
                    <div className="w-12 h-12 mb-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-lg">G</span>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        formData.paymentMethod === "gopay" ? "text-blue-600" : "text-gray-700"
                      }`}
                    >
                      GoPay
                    </span>
                    <span className="text-xs text-gray-500 mt-1">2%</span>
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
                    <div className="w-12 h-12 mb-2 bg-gradient-to-br from-gray-400 to-gray-500 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-white"
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
                    <span
                      className={`text-sm font-semibold ${
                        formData.paymentMethod === "bank_transfer"
                          ? "text-blue-600"
                          : "text-gray-700"
                      }`}
                    >
                      Bank Transfer
                    </span>
                    <span className="text-xs text-gray-500 mt-1">0%</span>
                  </button>

                  {/* Credit Card Button */}
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, paymentMethod: "credit_card" }))
                    }
                    className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center justify-center ${
                      formData.paymentMethod === "credit_card"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="w-12 h-12 mb-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-white"
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
                    <span
                      className={`text-sm font-semibold ${
                        formData.paymentMethod === "credit_card"
                          ? "text-blue-600"
                          : "text-gray-700"
                      }`}
                    >
                      Credit Card
                    </span>
                    <span className="text-xs text-gray-500 mt-1">2.9%</span>
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
                    {["bca", "bni", "mandiri", "permata"].map((bank) => (
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
                      <div className="relative crypto-dropdown-container">
                        <button
                          type="button"
                          onClick={() => setShowCryptoDropdown(!showCryptoDropdown)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-left flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            {formData.currency ? (
                              <>
                                <img
                                  src={
                                    cryptoCurrencies.find((c) => c.cid === formData.currency)
                                      ?.icon || ""
                                  }
                                  alt=""
                                  className="w-6 h-6"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                  }}
                                />
                                <span>
                                  {
                                    cryptoCurrencies.find((c) => c.cid === formData.currency)
                                      ?.name
                                  }{" "}
                                  (
                                  {
                                    cryptoCurrencies.find((c) => c.cid === formData.currency)
                                      ?.currency
                                  }
                                  )
                                </span>
                              </>
                            ) : (
                              <span className="text-gray-500">
                                Auto (Plisio akan memilih otomatis)
                              </span>
                            )}
                          </div>
                          {showCryptoDropdown ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          )}
                        </button>

                        {showCryptoDropdown && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, currency: "" }));
                                setShowCryptoDropdown(false);
                                setMinAmountUsd(1.0); // Reset to default minimum
                              }}
                              className={`w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 ${
                                !formData.currency ? "bg-blue-50 text-blue-600" : ""
                              }`}
                            >
                              <span className="text-gray-500">Auto (Plisio akan memilih otomatis)</span>
                            </button>
                            {cryptoCurrencies.map((crypto) => (
                              <button
                                key={crypto.cid}
                                type="button"
                                onClick={() => {
                                  setFormData((prev) => ({ ...prev, currency: crypto.cid }));
                                  setShowCryptoDropdown(false);
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
                                className={`w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 ${
                                  formData.currency === crypto.cid
                                    ? "bg-blue-50 text-blue-600"
                                    : ""
                                }`}
                              >
                                <img
                                  src={crypto.icon}
                                  alt={crypto.name}
                                  className="w-6 h-6"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                  }}
                                />
                                <span>
                                  {crypto.name} ({crypto.currency})
                                  {crypto.hidden ? " [Hidden]" : ""}
                                  {crypto.maintenance ? " [Maintenance]" : ""}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Biarkan kosong untuk memilih otomatis, atau pilih cryptocurrency spesifik. Total {cryptoCurrencies.length} cryptocurrency tersedia. Jumlah USD akan dikonversi ke cryptocurrency yang dipilih.
                    </p>
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
    </div>
  );
}
