"use client";

import React, { useState } from "react";
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
  paymentMethod: "bank_transfer" | "gopay" | "credit_card" | "qris";
  bank?: string;
}

export default function DonatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [startTimeMinutes, setStartTimeMinutes] = useState<number>(0);
  const [formData, setFormData] = useState<CreatePaymentRequest>({
    donorName: "",
    donorEmail: "",
    amount: 0,
    donationType: "text",
    message: "",
    notes: "",
    paymentMethod: "qris",
    bank: "bca",
  });

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Convert startTime from minutes to seconds before sending
      const submitData = {
        ...formData,
        startTime: startTimeMinutes > 0 ? startTimeMinutes * 60 : undefined,
      };

      const response = await fetch(`${apiBaseUrl}/payment/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (data.success && data.data) {
        // Redirect to payment detail page using UUID ID or order ID
        const paymentId = data.data.id || data.data.orderId;
        router.push(`/donate/${paymentId}`);
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
    setFormData((prev) => ({
      ...prev,
      [name]: name === "amount" ? parseInt(value) || 0 : value,
    }));
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
                  Jumlah Donasi (Rp) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  value={formData.amount || ""}
                  onChange={handleInputChange}
                  required
                  min="1000"
                  placeholder="10000"
                />
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
