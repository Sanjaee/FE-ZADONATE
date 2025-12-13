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
import { Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";

export default function VerifyResetPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Get email and verified OTP from session storage
  useEffect(() => {
    const storedEmail = sessionStorage.getItem("reset_password_email");
    const verifiedOtp = sessionStorage.getItem("verified_otp");

    if (storedEmail) {
      setEmail(storedEmail);
    } else {
      // If no email found, redirect to reset password page
      router.push("/auth/reset-password");
    }

    if (!verifiedOtp) {
      // If no verified OTP found, redirect to OTP verification page
      router.push("/auth/verify-otp-reset");
    }
  }, [router]);

  const verifyResetPassword = async () => {
    if (!email) {
      toast({
        title: "❌ Email Tidak Ditemukan",
        description: "Silakan mulai ulang proses reset password",
        variant: "destructive",
      });
      return;
    }

    if (!newPassword || !confirmPassword) {
      toast({
        title: "❌ Password Diperlukan",
        description: "Silakan masukkan password baru dan konfirmasi password",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "❌ Password Tidak Cocok",
        description: "Password baru dan konfirmasi password tidak sama",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "❌ Password Terlalu Pendek",
        description: "Password minimal 8 karakter",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length > 128) {
      toast({
        title: "❌ Password Terlalu Panjang",
        description: "Password maksimal 128 karakter",
        variant: "destructive",
      });
      return;
    }

    const verifiedOtp = sessionStorage.getItem("verified_otp");
    if (!verifiedOtp) {
      toast({
        title: "❌ OTP Belum Diverifikasi",
        description: "Silakan verifikasi OTP terlebih dahulu",
        variant: "destructive",
      });
      router.push("/auth/verify-otp-reset");
      return;
    }

    setIsVerifying(true);
    setLoading(true);

    try {
      await api.verifyResetPassword({
        email,
        otp_code: verifiedOtp,
        new_password: newPassword,
      });

      toast({
        title: "🎉 Password Berhasil Direset!",
        description: "Password Anda telah berhasil direset. Silakan login dengan password baru Anda.",
      });

      // Clear session storage
      sessionStorage.removeItem("reset_password_email");
      sessionStorage.removeItem("verified_otp");

      // Redirect to login page - user must login with new password
      router.push("/auth/login");
    } catch (error) {
      console.error("Verify reset password error:", error);
      
      // Parse error message from backend
      let errorMessage = "Terjadi kesalahan saat verifikasi. Silakan coba lagi atau hubungi support.";
      let shouldRedirectToOTP = false;
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check if error is validation error (password too short/long)
        if (errorMessage.includes("minimal 8 karakter") || 
            errorMessage.includes("Password minimal") ||
            (errorMessage.includes("min") && errorMessage.includes("NewPassword"))) {
          errorMessage = "Password minimal 8 karakter. Silakan masukkan password yang lebih panjang.";
          // Don't redirect to OTP page for validation errors
          shouldRedirectToOTP = false;
        } else if (errorMessage.includes("maksimal 128 karakter") || 
                   errorMessage.includes("Password maksimal")) {
          errorMessage = "Password maksimal 128 karakter. Silakan masukkan password yang lebih pendek.";
          // Don't redirect to OTP page for validation errors
          shouldRedirectToOTP = false;
        } else if (errorMessage.includes("invalid or expired OTP") ||
                   errorMessage.includes("OTP tidak valid")) {
          // Only clear OTP and redirect if OTP is invalid/expired
          errorMessage = "Kode OTP tidak valid atau sudah expired. Silakan verifikasi ulang OTP.";
          shouldRedirectToOTP = true;
        }
      }
      
      // Only redirect to OTP page if OTP-related error, not validation error
      if (shouldRedirectToOTP) {
        sessionStorage.removeItem("verified_otp");
        toast({
          title: "❌ OTP Tidak Valid atau Expired",
          description: errorMessage,
          variant: "destructive",
        });
        router.push("/auth/verify-otp-reset");
        return;
      }
      
      toast({
        title: "❌ Reset Password Gagal",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Don't clear OTP session storage on validation errors
      // Only clear on OTP-related errors (handled above)
      setIsVerifying(false);
    } finally {
      setLoading(false);
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyResetPassword();
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
            <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-50">
              Set Password Baru
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              OTP telah diverifikasi untuk <br />
              <span className="font-semibold text-blue-600 dark:text-blue-400 break-all">
                {email}
              </span>
              <br />
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2 block">
                Masukkan password baru Anda
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-6">
               

                <div className="grid gap-3">
                  <Label htmlFor="newPassword">Password Baru</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Masukkan password baru (min 8 karakter)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 pr-10"
                      minLength={8}
                      maxLength={128}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3">
                  <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Konfirmasi password baru"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      loading || isVerifying || !newPassword || !confirmPassword
                    }
                  >
                    {(loading || isVerifying) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {loading || isVerifying
                      ? "Mereset Password..."
                      : "Reset Password"}
                  </Button>
                </div>

                <div className="text-center px-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.push("/auth/verify-otp-reset")}
                    className="text-xs sm:text-sm text-gray-600 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300 w-full sm:w-auto"
                  >
                    ← Kembali ke verifikasi OTP
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
