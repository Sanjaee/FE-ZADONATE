import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Mail, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

export default function VerifyOtpReset() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastVerificationTime, setLastVerificationTime] = useState(0);

  // Get email from session storage
  useEffect(() => {
    const storedEmail = sessionStorage.getItem("reset_password_email");
    if (storedEmail) {
      setEmail(storedEmail);
    } else {
      // If no email found, redirect to reset password page
      router.push("/auth/reset-password");
    }
  }, [router]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    return `${seconds}s`;
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value.replace(/[^0-9]/g, ""); // Only allow numbers
    setOtp(newOtp);

    // Move to next input if value is entered
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }

    // Auto-verify when all 6 digits are entered
    if (value && index === 5) {
      const updatedOtp = [...newOtp];
      updatedOtp[index] = value.replace(/[^0-9]/g, "");
      const otpString = updatedOtp.join("");

      if (otpString.length === 6 && !isVerifying) {
        const now = Date.now();
        // Prevent multiple rapid verifications (debounce)
        if (now - lastVerificationTime > 1000) {
          setLastVerificationTime(now);
          // Small delay to ensure the last digit is set
          setTimeout(() => {
            verifyOtp(otpString);
          }, 100);
        }
      }
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData
      .getData("text")
      .replace(/[^0-9]/g, "")
      .slice(0, 6);
    const newOtp = [...otp];

    for (let i = 0; i < pastedData.length; i++) {
      if (i < 6) newOtp[i] = pastedData[i];
    }

    setOtp(newOtp);

    // Auto-verify if 6 digits are pasted
    if (pastedData.length === 6 && !isVerifying) {
      const now = Date.now();
      // Prevent multiple rapid verifications (debounce)
      if (now - lastVerificationTime > 1000) {
        setLastVerificationTime(now);
        setTimeout(() => {
          verifyOtp(pastedData);
        }, 100);
      }
    }
  };

  const verifyOtp = async (otpString: string) => {
    if (!email) {
      toast({
        title: "❌ Email Tidak Ditemukan",
        description: "Silakan mulai ulang proses reset password",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    setLoading(true);

    try {
      // Store OTP in session storage for next step
      // OTP akan diverifikasi saat reset password di halaman berikutnya
      sessionStorage.setItem("verified_otp", otpString);

      toast({
        title: "✅ Kode OTP Disimpan!",
        description:
          "Kode OTP telah disimpan. Lanjutkan ke halaman reset password.",
      });

      // Redirect to reset password page
      router.push("/auth/verify-reset-password");
    } catch (error) {
      console.error("Verify OTP error:", error);
      toast({
        title: "❌ Verifikasi Gagal",
        description:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat verifikasi. Silakan coba lagi atau hubungi support.",
        variant: "destructive",
      });
      // Clear OTP on error and reset verification state
      setOtp(["", "", "", "", "", ""]);
      setIsVerifying(false);
      setLastVerificationTime(0);
      // Focus on first input
      const firstInput = document.getElementById("otp-0");
      firstInput?.focus();
    } finally {
      setLoading(false);
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const otpString = otp.join("");
    if (otpString.length !== 6) {
      toast({
        title: "❌ Kode Tidak Valid",
        description: "Silakan masukkan 6 digit kode yang valid",
        variant: "destructive",
      });
      return;
    }

    await verifyOtp(otpString);
  };

  const handleResendOtp = async () => {
    if (!canResend || !email) return;

    setResendLoading(true);

    // Start countdown after clicking resend
    setTimeLeft(30);
    setCanResend(false);

    try {
      const response = await api.requestResetPassword({ email });

      toast({
        title: "✅ Kode Reset Terkirim!",
        description: response.message,
      });
      // Timer already set above, no need to reset here
      setOtp(["", "", "", "", "", ""]); // Clear current OTP
      setLastVerificationTime(0); // Reset verification time
    } catch (error) {
      console.error("Resend reset password error:", error);
      toast({
        title: "❌ Gagal Mengirim",
        description:
          error instanceof Error
            ? error.message
            : "Gagal mengirim ulang kode reset. Silakan coba lagi atau hubungi support.",
        variant: "destructive",
      });
    } finally {
      setResendLoading(false);
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md mx-auto">
        <Card className="w-full dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-50">
              Verifikasi OTP
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Kode reset telah dikirim ke{" "}
              <span className="font-semibold text-blue-600 dark:text-blue-400 break-all">
                {email}
              </span>
              <br />
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2 block">
                Masukkan kode verifikasi untuk melanjutkan
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-3">
                  <Label>Kode Verifikasi</Label>
                  <div
                    className="flex gap-2 items-center justify-center"
                    onPaste={handlePaste}
                  >
                    {otp.map((digit, index) => (
                      <Input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        className={`w-10 h-10 sm:w-12 sm:h-12 text-center text-base sm:text-lg font-semibold ${
                          isVerifying ? "opacity-50" : ""
                        }`}
                        disabled={loading || isVerifying}
                      />
                    ))}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center flex items-center justify-center gap-2">
                    {isVerifying && (
                      <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                    )}
                    <span className="text-center">
                      {isVerifying
                        ? "Memverifikasi kode..."
                        : "Masukkan 6 digit kode yang dikirim ke email Anda"}
                    </span>
                  </div>
                  {otp.join("").length === 6 && !isVerifying && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 text-center">
                      ✨ Kode akan diverifikasi secara otomatis
                    </p>
                  )}
                  {email && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2 px-2">
                      Periksa folder spam jika email tidak ditemukan
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      loading || isVerifying || otp.join("").length !== 6
                    }
                  >
                    {(loading || isVerifying) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {loading || isVerifying
                      ? "Memverifikasi..."
                      : "Verifikasi OTP"}
                  </Button>
                </div>

                <div className="text-center px-2">
                  {!canResend ? (
                    <div className="space-y-2">
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        Kirim ulang kode dalam {formatTime(timeLeft)}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        Tidak menerima email?
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleResendOtp}
                        disabled={resendLoading}
                        className="text-xs sm:text-sm w-full sm:w-auto bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        {resendLoading ? "Mengirim..." : "Kirim Ulang Kode"}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="text-center px-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.push("/auth/reset-password")}
                    className="text-xs sm:text-sm text-gray-600 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300 w-full sm:w-auto"
                  >
                    ← Kembali ke request reset
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
