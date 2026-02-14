"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { z } from "zod";
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
import { useToast } from "@/hooks/use-toast";
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
  paymentMethod: "bank_transfer" | "gopay" | "qris" | "crypto" | "credit_card";
  bank?: string;
  currency?: string;
  cardTokenId?: string;
  saveCard?: boolean;
}

/** Card input for Midtrans getCardToken (tidak dikirim ke backend, hanya untuk dapat token_id) */
interface CardInputState {
  cardNumber: string;
  cardExpMonth: string;
  cardExpYear: string;
  cardCvv: string;
  bankOneTimeToken: string;
}

// USD to IDR conversion rate (configurable)
const USD_TO_IDR_RATE = 16500;

// Zod schema for form validation
// Base schema
const baseCreatePaymentSchema = z.object({
  donorName: z
    .string()
    .min(1, "Nama donatur wajib diisi")
    .max(16, "Nama donatur maksimal 16 karakter"),
  donorEmail: z
    .string()
    .email("Format email tidak valid")
    .optional()
    .or(z.literal("")),
  amount: z
    .number()
    .min(1, "Jumlah donasi harus lebih dari 0"),
  donationType: z.enum(["gif", "text"]),
  mediaUrl: z
    .string()
    .url("Format URL tidak valid")
    .optional()
    .or(z.literal("")),
  mediaType: z.string().optional(),
  startTime: z.number().min(0).optional(),
  message: z
    .string()
    .min(1, "Pesan donasi wajib diisi")
    .max(250, "Pesan donasi maksimal 250 karakter"),
  notes: z.string().optional().or(z.literal("")),
  paymentMethod: z.enum(["bank_transfer", "gopay", "qris", "crypto", "credit_card"]),
  bank: z.string().optional(),
  currency: z.string().optional(),
  cardTokenId: z.string().optional(),
  saveCard: z.boolean().optional(),
  cardNumber: z.string().optional(),
  cardExpMonth: z.string().optional(),
  cardExpYear: z.string().optional(),
  cardCvv: z.string().optional(),
  bankOneTimeToken: z.string().optional(),
});

// Create final schema with refinements
const createPaymentSchema = baseCreatePaymentSchema.refine((data) => {
  // If donationType is "gif", mediaUrl is required
  if (data.donationType === "gif") {
    return data.mediaUrl && data.mediaUrl.trim().length > 0;
  }
  return true;
}, {
  message: "Media URL wajib diisi untuk tipe donasi Media",
  path: ["mediaUrl"],
}).refine((data) => {
  // If paymentMethod is "bank_transfer", bank is required
  if (data.paymentMethod === "bank_transfer") {
    return data.bank && data.bank.trim().length > 0;
  }
  return true;
}, {
  message: "Bank wajib dipilih untuk metode pembayaran Bank Transfer",
  path: ["bank"],
}).refine((data) => {
  if (data.paymentMethod === "credit_card") {
    const num = (data.cardNumber || "").replace(/\s/g, "");
    return num.length >= 15 && num.length <= 19 && /^\d+$/.test(num);
  }
  return true;
}, {
  message: "Nomor kartu wajib 15–19 digit",
  path: ["cardNumber"],
}).refine((data) => {
  if (data.paymentMethod === "credit_card") {
    const m = data.cardExpMonth || "";
    const y = data.cardExpYear || "";
    return m.length >= 1 && m.length <= 2 && parseInt(m, 10) >= 1 && parseInt(m, 10) <= 12 &&
           y.length >= 2 && y.length <= 4 && /^\d+$/.test(y);
  }
  return true;
}, {
  message: "Bulan (01–12) dan tahun kadaluarsa wajib diisi",
  path: ["cardExpMonth"],
}).refine((data) => {
  if (data.paymentMethod === "credit_card") {
    const cvv = (data.cardCvv || "").trim();
    return cvv.length >= 3 && cvv.length <= 4 && /^\d+$/.test(cvv);
  }
  return true;
}, {
  message: "CVV wajib 3 atau 4 digit",
  path: ["cardCvv"],
}).refine((data) => {
  // For non-crypto payment methods, amount must be >= 1000 (IDR minimum)
  if (data.paymentMethod !== "crypto") {
    return data.amount >= 1000;
  }
  return true;
}, {
  message: "Minimum donasi Rp 1.000",
  path: ["amount"],
}).refine((data) => {
  // For non-crypto payment methods, amount must be an integer (IDR)
  if (data.paymentMethod !== "crypto") {
    return Number.isInteger(data.amount);
  }
  return true;
}, {
  message: "Jumlah donasi harus berupa bilangan bulat",
  path: ["amount"],
});

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
  if (method === "credit_card") {
    return `${baseUrl}/card/credit_card.png`;
  }
  return null;
};

export default function DonatePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [startTimeMinutes, setStartTimeMinutes] = useState<number>(0);
  const [cryptoCurrencies, setCryptoCurrencies] = useState<any[]>([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [showCryptoDialog, setShowCryptoDialog] = useState(false);
  const [minAmountUsd, setMinAmountUsd] = useState<number>(1.0);
  const [usdAmount, setUsdAmount] = useState<string>(""); // For crypto: USD input as string (e.g., "3.12")
  const [formattedAmount, setFormattedAmount] = useState<string>(""); // For non-crypto: formatted Rupiah with dots (e.g., "50.000")
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [testHitLoading, setTestHitLoading] = useState(false);
  const [testHitMessage, setTestHitMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreatePaymentRequest & { cardNumber?: string; cardExpMonth?: string; cardExpYear?: string; cardCvv?: string; bankOneTimeToken?: string }>({
    donorName: "",
    donorEmail: "",
    amount: 0,
    donationType: "text",
    message: "",
    notes: "",
    paymentMethod: "qris",
    bank: "bca",
    currency: "",
    cardTokenId: "",
    saveCard: false,
    cardNumber: "",
    cardExpMonth: "",
    cardExpYear: "",
    cardCvv: "",
    bankOneTimeToken: "",
  });
  const [midtransScriptLoaded, setMidtransScriptLoaded] = useState(false);
  const [show3DSModal, setShow3DSModal] = useState(false);
  const [url3DS, setUrl3DS] = useState("");
  const [paymentSuccessAfter3DS, setPaymentSuccessAfter3DS] = useState<string | null>(null);
  const threeDSModalRef = React.useRef<{ close: () => void } | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const midtransClientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "SB-Mid-client-AyXigF7mydBiMeLq";
  const midtransEnv = process.env.NEXT_PUBLIC_MIDTRANS_ENV || "sandbox";

  // Load Midtrans New 3DS JS (untuk getCardToken & authenticate)
  // Library mencari script dengan id="midtrans-script" untuk getAttribute('data-client-key')
  useEffect(() => {
    if (formData.paymentMethod !== "credit_card" || !midtransClientKey) return;
    const scriptId = "midtrans-script";
    if (document.getElementById(scriptId)) {
      setMidtransScriptLoaded(!!window.MidtransNew3ds);
      return;
    }
    const script = document.createElement("script");
    script.id = scriptId;
    script.type = "text/javascript";
    script.src = "https://api.midtrans.com/v2/assets/js/midtrans-new-3ds.min.js";
    script.setAttribute("data-environment", midtransEnv);
    script.setAttribute("data-client-key", midtransClientKey);
    script.async = true;
    script.onload = () => setMidtransScriptLoaded(!!window.MidtransNew3ds);
    document.body.appendChild(script);
    return () => {
      const el = document.getElementById(scriptId);
      if (el) el.remove();
      setMidtransScriptLoaded(false);
    };
  }, [formData.paymentMethod, midtransClientKey, midtransEnv]);

  // Tes hit: trigger dummy media share (1k, YouTube) untuk cek overlay /donate/gif
  const handleTestHit = async () => {
    setTestHitMessage(null);
    setTestHitLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/test-media-share`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setTestHitMessage("Tes hit terkirim! Buka /donate/gif untuk lihat media share.");
        setTimeout(() => setTestHitMessage(null), 4000);
      } else {
        setTestHitMessage(data?.error || "Gagal mengirim tes hit");
      }
    } catch {
      setTestHitMessage("Gagal koneksi ke backend");
    } finally {
      setTestHitLoading(false);
    }
  };

  // Reset USD amount when switching payment method
  useEffect(() => {
    if (formData.paymentMethod !== "crypto") {
      setUsdAmount("");
      // Format current amount when switching to non-crypto
      if (formData.amount > 0) {
        setFormattedAmount(formData.amount.toLocaleString("id-ID"));
      } else {
        setFormattedAmount("");
      }
    } else {
      setFormattedAmount("");
    }
  }, [formData.paymentMethod, formData.amount]);

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

  // Function to scroll to first error field
  const scrollToFirstError = (errors: Record<string, string>) => {
    const firstErrorField = Object.keys(errors)[0];
    if (firstErrorField) {
      const element = document.getElementById(firstErrorField);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.focus();
      }
    }
  };

  // Function to scroll to bottom when payment method is clicked
  const scrollToBottom = () => {
    setTimeout(() => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setFormErrors({});
    
    // Additional validation for crypto payment method
    if (formData.paymentMethod === "crypto") {
      const usdValue = parseFloat(usdAmount) || 0;
      if (!usdAmount || usdAmount.trim() === "" || usdValue <= 0) {
        const errorMsg = formData.currency 
          ? `Jumlah donasi USD wajib diisi (minimum $${minAmountUsd.toFixed(2)})`
          : "Jumlah donasi USD wajib diisi (minimum $0.01)";
        setFormErrors({ amount: errorMsg });
        toast({
          title: "Validasi Gagal",
          description: errorMsg,
          variant: "destructive",
        });
        setTimeout(() => {
          scrollToFirstError({ amount: errorMsg });
        }, 100);
        return;
      }
      
      // Check minimum amount if currency is selected
      if (formData.currency && usdValue < minAmountUsd) {
        const errorMsg = `Jumlah donasi minimum adalah $${minAmountUsd.toFixed(2)} USD untuk cryptocurrency yang dipilih`;
        setFormErrors({ amount: errorMsg });
        toast({
          title: "Validasi Gagal",
          description: errorMsg,
          variant: "destructive",
        });
        setTimeout(() => {
          scrollToFirstError({ amount: errorMsg });
        }, 100);
        return;
      }
      
      // Check minimum 0.01 USD for crypto
      if (usdValue < 0.01) {
        const errorMsg = "Jumlah donasi minimum adalah $0.01 USD";
        setFormErrors({ amount: errorMsg });
        toast({
          title: "Validasi Gagal",
          description: errorMsg,
          variant: "destructive",
        });
        setTimeout(() => {
          scrollToFirstError({ amount: errorMsg });
        }, 100);
        return;
      }
    }
    
    try {
      // Validate form data with Zod
      createPaymentSchema.parse(formData);
      
      // Show confirmation dialog if validation passes
      setShowConfirmDialog(true);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        // Map Zod errors to form errors
        const errors: Record<string, string> = {};
        error.issues.forEach((err: z.ZodIssue) => {
          if (err.path.length > 0) {
            const field = err.path[0] as string;
            errors[field] = err.message;
          }
        });
        setFormErrors(errors);
        
        // Show toast with error messages
        const errorMessages = Object.values(errors).join(", ");
        toast({
          title: "Validasi Gagal",
          description: `Mohon perbaiki input berikut: ${errorMessages}`,
          variant: "destructive",
        });
        
        // Scroll to first error field
        setTimeout(() => {
          scrollToFirstError(errors);
        }, 100);
      } else {
        console.error("Validation error:", error);
        toast({
          title: "Validasi Gagal",
          description: "Terjadi kesalahan validasi. Silakan coba lagi.",
          variant: "destructive",
        });
      }
    }
  };

  const close3DSModal = () => {
    setShow3DSModal(false);
    setUrl3DS("");
    threeDSModalRef.current = null;
  };

  const handleConfirmPayment = async () => {
    setShowConfirmDialog(false);
    setLoading(true);

    try {
      if (formData.paymentMethod === "credit_card") {
        if (!midtransClientKey) {
          toast({ title: "Konfigurasi", description: "NEXT_PUBLIC_MIDTRANS_CLIENT_KEY belum di-set.", variant: "destructive" });
          setLoading(false);
          return;
        }
        if (!window.MidtransNew3ds) {
          toast({ title: "Midtrans", description: "Script Midtrans belum siap. Tunggu sebentar lalu coba lagi.", variant: "destructive" });
          setLoading(false);
          return;
        }
        const cardNumber = (formData.cardNumber || "").replace(/\s/g, "");
        const expMonth = parseInt(formData.cardExpMonth || "0", 10) || 1;
        const expYear = parseInt(formData.cardExpYear || "0", 10) || new Date().getFullYear();
        const cardData = {
          card_number: cardNumber,
          card_exp_month: expMonth,
          card_exp_year: expYear,
          card_cvv: formData.cardCvv || "",
          ...(formData.bankOneTimeToken ? { bank_one_time_token: formData.bankOneTimeToken } : {}),
        };
        window.MidtransNew3ds.getCardToken(cardData, {
          onSuccess: async (response) => {
            try {
              const tokenId = response.token_id;
              const submitData = {
                donorName: formData.donorName,
                donorEmail: formData.donorEmail,
                amount: formData.amount,
                donationType: formData.donationType,
                message: formData.message,
                notes: formData.notes,
                paymentMethod: "credit_card" as const,
                startTime: startTimeMinutes > 0 ? startTimeMinutes * 60 : undefined,
                mediaUrl: formData.mediaUrl,
                mediaType: formData.mediaType,
                cardTokenId: tokenId,
                saveCard: formData.saveCard ?? false,
              };
              const endpoint = `${apiBaseUrl}/payment/create`;
              const responseApi = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(submitData),
              });
              const data = await responseApi.json();
              if (!data.success || !data.data) {
                toast({ title: "Gagal Membuat Pembayaran", description: data.error || "Unknown error", variant: "destructive" });
                setLoading(false);
                return;
              }
              const redirectUrl = data.data.redirectUrl;
              const paymentId = data.data.payment?.id || data.data.id || data.data.orderId;
              if (redirectUrl && window.MidtransNew3ds) {
                window.MidtransNew3ds.authenticate(redirectUrl, {
                  performAuthentication: (url: string) => {
                    setUrl3DS(url);
                    setShow3DSModal(true);
                  },
                  onSuccess: async (response) => {
                    close3DSModal();
                    setLoading(false);
                    const status = response?.transaction_status as string | undefined;
                    const orderId = (response?.order_id as string) || undefined;
                    try {
                      if (orderId && (status === "capture" || status === "settlement")) {
                        await fetch(`${apiBaseUrl}/payment/confirm-3ds`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(response),
                        });
                      }
                    } catch (e) {
                      console.warn("[3DS] confirm-3ds request failed:", e);
                    }
                    if (paymentId) setPaymentSuccessAfter3DS(paymentId);
                    else toast({ title: "Pembayaran Berhasil", description: "Transaksi berhasil." });
                  },
                  onFailure: () => {
                    close3DSModal();
                    setLoading(false);
                    toast({ title: "Verifikasi 3DS Gagal", description: "Pembayaran ditolak atau dibatalkan.", variant: "destructive" });
                    if (paymentId) router.push(`/${paymentId}`);
                  },
                  onPending: async (response: unknown) => {
                    close3DSModal();
                    setLoading(false);
                    const res = response as Record<string, unknown> | undefined;
                    const status = res?.transaction_status as string | undefined;
                    const orderId = res?.order_id as string | undefined;
                    if (orderId && (status === "capture" || status === "settlement")) {
                      try {
                        await fetch(`${apiBaseUrl}/payment/confirm-3ds`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(response),
                        });
                      } catch (e) {
                        console.warn("[3DS] confirm-3ds (onPending) failed:", e);
                      }
                      if (paymentId) setPaymentSuccessAfter3DS(paymentId);
                      return;
                    }
                    if (paymentId) router.push(`/${paymentId}`);
                    toast({ title: "Menunggu", description: "Menunggu konfirmasi pembayaran." });
                  },
                });
              } else {
                setLoading(false);
                if (paymentId) router.push(`/${paymentId}`);
                else toast({ title: "Pembayaran Dibuat", description: "Lihat halaman payment untuk status." });
              }
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              const stack = err instanceof Error ? err.stack : undefined;
              console.error("[Payment Credit Card onSuccess]", err);
              console.error("[Payment Credit Card onSuccess] message:", msg);
              if (stack) console.error("[Payment Credit Card onSuccess] stack:", stack);
              setLoading(false);
              toast({ title: "Gagal Membuat Pembayaran", description: msg, variant: "destructive" });
            }
          },
          onFailure: (response) => {
            setLoading(false);
            console.error("Midtrans getCardToken failure:", response);
            const msg = (response as { status_message?: string })?.status_message || "Gagal mendapatkan token kartu. Periksa data kartu.";
            toast({ title: "Token Kartu Gagal", description: msg, variant: "destructive" });
          },
        });
        return;
      }

      // Non–credit_card flow
      const submitData: Record<string, unknown> = {
        ...formData,
        startTime: startTimeMinutes > 0 ? startTimeMinutes * 60 : undefined,
      };

      const endpoint =
        formData.paymentMethod === "crypto"
          ? `${apiBaseUrl}/payment/plisio/create`
          : `${apiBaseUrl}/payment/create`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (data.success && data.data) {
        if (formData.paymentMethod === "crypto") {
          const invoiceUrl = data.data.invoiceUrl || data.data.invoice?.invoiceUrl;
          if (invoiceUrl) {
            window.location.href = invoiceUrl;
            return;
          }
        }

        const paymentId = data.data.payment?.id || data.data.id || data.data.orderId;
        if (paymentId) router.push(`/${paymentId}`);
        else toast({ title: "Error", description: "Payment created but unable to redirect", variant: "destructive" });
      } else {
        toast({ title: "Gagal Membuat Pembayaran", description: data.error || "Unknown error", variant: "destructive" });
      }
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      console.error("[Payment Error]", error);
      console.error("[Payment Error] message:", errMessage);
      if (errStack) console.error("[Payment Error] stack:", errStack);
      toast({
        title: "Gagal Membuat Pembayaran",
        description: errMessage || "Terjadi kesalahan saat membuat pembayaran. Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    
    // Clear error for this field when user types
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
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
        // For non-crypto: integer rupiah with formatting
        // Remove dots and non-numeric characters except numbers
        const numericValue = value.replace(/[^0-9]/g, "");
        const parsedAmount = parseInt(numericValue) || 0;
        
        // Update formatted display value
        setFormattedAmount(numericValue ? parsedAmount.toLocaleString("id-ID") : "");
        
        // Update actual amount value
        setFormData((prev) => ({
          ...prev,
          [name]: parsedAmount,
        }));
      }
    } else {
      // For donorName, limit to 16 characters
      if (name === "donorName") {
        const limitedValue = value.slice(0, 16);
        setFormData((prev) => ({
          ...prev,
          [name]: limitedValue,
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
        }));
      }
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-3xl">Buat Donasi</CardTitle>
                <CardDescription>
                  Isi formulir di bawah ini untuk membuat donasi
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestHit}
                disabled={testHitLoading}
                className="shrink-0 border-amber-500 text-amber-700 hover:bg-amber-50"
              >
                {testHitLoading ? "Mengirim…" : "Tes Hit"}
              </Button>
            </div>
            {testHitMessage && (
              <p className="text-sm text-muted-foreground mt-1">{testHitMessage}</p>
            )}
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
                  
                  placeholder="Masukkan nama Anda"
                  maxLength={16}
                  className={formErrors.donorName ? "border-red-500 animate-pulse" : ""}
                />
                {formErrors.donorName && (
                  <p className="text-sm text-red-500">{formErrors.donorName}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {formData.donorName.length}/16 karakter
                </p>
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
                  type="text"
                  value={
                    formData.paymentMethod === "crypto"
                      ? usdAmount
                      : formattedAmount
                  }
                  onChange={handleInputChange}
                  
                  placeholder={
                    formData.paymentMethod === "crypto"
                      ? `3.12 (minimum $${minAmountUsd.toFixed(2)})`
                      : "50.000"
                  }
                  className={formErrors.amount ? "border-red-500 animate-pulse" : ""}
                />
                {formErrors.amount && (
                  <p className="text-sm text-red-500">{formErrors.amount}</p>
                )}
                {formData.paymentMethod !== "crypto" && (
                  <>
                    <div className="flex gap-2 flex-wrap">
                      {[1000, 10000, 20000, 50000].map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, amount }));
                            setFormattedAmount(amount.toLocaleString("id-ID"));
                          }}
                          className={`px-4 py-2 rounded-lg border-2 transition-all text-sm font-semibold cursor-pointer ${
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
                    className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all cursor-pointer ${
                      formData.donationType === "text"
                        ? "bg-black text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Text / Alert
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, donationType: "gif" }))}
                    className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all cursor-pointer ${
                      formData.donationType === "gif"
                        ? "bg-black text-white shadow-md"
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
                      
                      placeholder="https://example.com/video.mp4 atau YouTube URL"
                      className={formErrors.mediaUrl ? "border-red-500 animate-pulse" : ""}
                    />
                    {formErrors.mediaUrl && (
                      <p className="text-sm text-red-500">{formErrors.mediaUrl}</p>
                    )}
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
                  
                  placeholder="Pesan untuk donasi Anda (maks 250 karakter)"
                  className={formErrors.message ? "border-red-500 animate-pulse" : ""}
                />
                {formErrors.message && (
                  <p className="text-sm text-red-500">{formErrors.message}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {formData.message?.length || 0}/250 karakter
                </p>
              </div>

              {/* Optional Fields Accordion */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowOptional(!showOptional)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
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
                        className={formErrors.donorEmail ? "border-red-500 animate-pulse" : ""}
                      />
                      {formErrors.donorEmail && (
                        <p className="text-sm text-red-500">{formErrors.donorEmail}</p>
                      )}
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
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, paymentMethod: "crypto" }));
                      scrollToBottom();
                    }}
                    className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center justify-center cursor-pointer ${
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
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, paymentMethod: "qris" }));
                      scrollToBottom();
                    }}
                    className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center justify-center cursor-pointer ${
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
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, paymentMethod: "gopay" }));
                      scrollToBottom();
                    }}
                    className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center justify-center cursor-pointer ${
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
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, paymentMethod: "bank_transfer" }));
                      scrollToBottom();
                    }}
                    className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center justify-center cursor-pointer ${
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

                  {/* Credit Card Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, paymentMethod: "credit_card" }));
                      scrollToBottom();
                    }}
                    className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center justify-center cursor-pointer ${
                      formData.paymentMethod === "credit_card"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    {getPaymentMethodLogo("credit_card") ? (
                      <img
                        src={getPaymentMethodLogo("credit_card")!}
                        alt="Credit Card"
                        className="w-16 h-16 object-contain mb-2"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center mb-2">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                    )}
                    <span className="text-xs text-gray-500">Kartu Kredit</span>
                  </button>
                </div>
              </div>

              {/* Credit Card: input kartu (Midtrans Get Card Token) */}
              {formData.paymentMethod === "credit_card" && (
                <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                  {!midtransClientKey && (
                    <p className="text-sm text-amber-600">
                      Set NEXT_PUBLIC_MIDTRANS_CLIENT_KEY di env untuk pembayaran kartu.
                    </p>
                  )}
                  <div className="grid gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="cardNumber">Nomor Kartu <span className="text-red-500">*</span></Label>
                      <Input
                        id="cardNumber"
                        name="cardNumber"
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-number"
                        maxLength={19}
                        value={formData.cardNumber || ""}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 19);
                          setFormData((prev) => ({ ...prev, cardNumber: v }));
                          if (formErrors.cardNumber) setFormErrors((p) => ({ ...p, cardNumber: "" }));
                        }}
                        placeholder="4811 1111 1111 1114"
                        className={formErrors.cardNumber ? "border-red-500" : ""}
                      />
                      {formErrors.cardNumber && <p className="text-sm text-red-500">{formErrors.cardNumber}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="cardExpMonth">Bulan Kadaluarsa (MM) <span className="text-red-500">*</span></Label>
                        <Input
                          id="cardExpMonth"
                          name="cardExpMonth"
                          type="text"
                          inputMode="numeric"
                          maxLength={2}
                          placeholder="02"
                          value={formData.cardExpMonth || ""}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                            setFormData((prev) => ({ ...prev, cardExpMonth: v }));
                            if (formErrors.cardExpMonth) setFormErrors((p) => ({ ...p, cardExpMonth: "" }));
                          }}
                          className={formErrors.cardExpMonth ? "border-red-500" : ""}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cardExpYear">Tahun (YYYY) <span className="text-red-500">*</span></Label>
                        <Input
                          id="cardExpYear"
                          name="cardExpYear"
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="2025"
                          value={formData.cardExpYear || ""}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                            setFormData((prev) => ({ ...prev, cardExpYear: v }));
                            if (formErrors.cardExpYear) setFormErrors((p) => ({ ...p, cardExpYear: "" }));
                          }}
                          className={formErrors.cardExpYear ? "border-red-500" : ""}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cardCvv">CVV <span className="text-red-500">*</span></Label>
                      <Input
                        id="cardCvv"
                        name="cardCvv"
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        maxLength={4}
                        value={formData.cardCvv || ""}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                          setFormData((prev) => ({ ...prev, cardCvv: v }));
                          if (formErrors.cardCvv) setFormErrors((p) => ({ ...p, cardCvv: "" }));
                        }}
                        placeholder="123"
                        className={formErrors.cardCvv ? "border-red-500" : ""}
                      />
                      {formErrors.cardCvv && <p className="text-sm text-red-500">{formErrors.cardCvv}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bankOneTimeToken">Bank One Time Token (opsional, untuk 3DS)</Label>
                      <Input
                        id="bankOneTimeToken"
                        name="bankOneTimeToken"
                        type="text"
                        value={formData.bankOneTimeToken || ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, bankOneTimeToken: e.target.value }))}
                        placeholder="12345678 (sandbox)"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sandbox: 4811 1111 1111 1114, CVV 123, Exp 02/2025, OTP 3DS: 112233, Bank token: 12345678
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.saveCard || false}
                      onChange={(e) => setFormData((prev) => ({ ...prev, saveCard: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Simpan kartu (One Click)</span>
                  </label>
                </div>
              )}

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
                        className={`px-4 py-2 rounded-lg border-2 transition-all cursor-pointer ${
                          formData.bank === bank
                            ? "border-blue-600 bg-blue-50 text-blue-600 font-semibold"
                            : "border-gray-200 bg-white hover:border-gray-300 text-gray-700"
                        }`}
                      >
                        {bank.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  {formErrors.bank && (
                    <p className="text-sm text-red-500 mt-2">{formErrors.bank}</p>
                  )}
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
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-left flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
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
                                <div className="text-sm text-gray-500">Pilih Saat Terbuat Invoice</div>
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
                className="w-full py-6 cursor-pointer"
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
              <span className="text-sm font-semibold text-gray-900">
                {getPaymentMethodLabel(formData.paymentMethod)}
              </span>
            </div>

            {/* Credit Card (if credit_card) */}
            {formData.paymentMethod === "credit_card" && (
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-sm text-gray-600">Kartu Kredit</span>
                <span className="text-sm font-semibold text-gray-900 font-mono">
                  **** {formData.cardNumber ? formData.cardNumber.slice(-4) : "****"}
                </span>
              </div>
            )}

            {/* Bank Selection (if bank_transfer) */}
            {formData.paymentMethod === "bank_transfer" && formData.bank && (
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-sm text-gray-600">Bank</span>
                <div className="flex items-center gap-2">
                  {getPaymentMethodLogo("bank_transfer", undefined, formData.bank) && (
                    <img
                      src={getPaymentMethodLogo("bank_transfer", undefined, formData.bank)!}
                      alt={formData.bank.toUpperCase()}
                      className="h-5 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                      }}
                    />
                  )}
                </div>
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
            <div className="flex flex-col gap-1 border-gray-200">
              <span className="text-sm text-gray-600">Pesan</span>
              <span className="text-sm font-medium text-gray-900 break-words">
                {formData.message || "-"}
              </span>
            </div>

            {/* Durasi Tampil - only for GIF donations */}
            {formData.donationType === "gif" && (
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
            )}
          </div>

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto py-5 mb-2">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmPayment}
              disabled={loading}
              className="w-full sm:w-auto bg-black hover:bg-gray-800 text-white py-6"
            >
              {loading ? "Memproses..." : "Konfirmasi & Bayar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Layar sukses langsung setelah OTP 3DS berhasil (tanpa redirect ke halaman 3DS lagi) */}
      {paymentSuccessAfter3DS && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Pembayaran Berhasil!</h2>
            <p className="text-gray-600 mb-6">Verifikasi 3D Secure selesai. Terima kasih telah berdonasi.</p>
            <Button
              onClick={() => {
                router.push(`/${paymentSuccessAfter3DS}`);
                setPaymentSuccessAfter3DS(null);
              }}
              className="w-full bg-black hover:bg-gray-800 text-white py-6"
            >
              Lihat Detail Pembayaran
            </Button>
          </div>
        </div>
      )}

      {/* 3DS Authentication - UI pas dengan halaman OTP Issuing Bank */}
      {show3DSModal && url3DS && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-[480px] sm:max-w-[520px] overflow-hidden border border-gray-200" style={{ height: "90vh", maxHeight: "640px" }}>
            {/* Header: Verifikasi 3D Secure — Issuing Bank */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-white border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Verifikasi 3D Secure</h2>
                  <p className="text-xs text-gray-500">Issuing Bank</p>
                </div>
              </div>
              <button
                type="button"
                onClick={close3DSModal}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Tutup"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Sandbox: masukkan 112233 di kolom Password */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100 shrink-0">
              <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-amber-800">
                Sandbox: masukkan <strong className="font-mono bg-amber-100/80 px-1 rounded">112233</strong> di kolom Password pada halaman bank di bawah.
              </p>
            </div>
            {/* Iframe: halaman Issuing Bank (OTP/Password) */}
            <div className="flex-1 min-h-0 relative bg-gray-50">
              <iframe
                title="Issuing Bank - 3D Secure"
                src={url3DS}
                className="absolute inset-0 w-full h-full border-0 bg-white rounded-b-2xl"
              />
            </div>
          </div>
        </div>
      )}

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
                  <div className="text-sm text-gray-500">Pilih Saat Terbuat Invoice</div>
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
