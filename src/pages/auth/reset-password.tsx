import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { signIn } from "next-auth/react";
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
import { Mail, Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";

export default function ResetPassword() {
  const router = useRouter();
  const { token, email: emailParam } = router.query;
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRequesting, setIsRequesting] = useState(true); // True if requesting reset, false if setting new password

  useEffect(() => {
    if (router.isReady) {
      // Check if we have token (user came from email link)
      if (token && typeof token === "string") {
        setIsRequesting(false);
        const emailFromQuery = emailParam as string;
        const emailFromStorage = sessionStorage.getItem("reset_password_email");
        
        if (emailFromQuery) {
          setEmail(emailFromQuery);
        } else if (emailFromStorage) {
          setEmail(emailFromStorage);
        }
      } else {
        // No token, show request form
        setIsRequesting(true);
      }
    }
  }, [router.isReady, token, emailParam]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "❌ Email Diperlukan",
        description: "Silakan masukkan email Anda",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await api.requestResetPassword({ email });

      toast({
        title: "✅ Kode OTP Terkirim!",
        description: "Silakan cek email Anda untuk kode OTP reset password. Kode akan expired dalam 10 menit.",
      });

      // Store email in session storage
      sessionStorage.setItem("reset_password_email", email);

      // Redirect to verify OTP page
      router.push("/auth/verify-otp-reset");
    } catch (error) {
      console.error("Request reset password error:", error);
      toast({
        title: "❌ Gagal Mengirim OTP",
        description:
          error instanceof Error
            ? error.message
            : "Gagal mengirim kode OTP reset. Silakan coba lagi atau hubungi support.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

    if (!token || typeof token !== "string") {
      toast({
        title: "❌ Token Tidak Valid",
        description: "Token reset password tidak ditemukan. Silakan request ulang.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Call reset password endpoint
      const response = await api.resetPassword({
        token: token,
        newPassword: newPassword,
      });

      toast({
        title: "🎉 Password Berhasil Direset!",
        description: "Password Anda telah direset. Mengarahkan...",
      });

      // Auto-login using JWT tokens from response
      const { signIn } = await import("next-auth/react");
      const loginResult = await signIn("credentials", {
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        redirect: false,
      });

      // Clear session storage
      sessionStorage.removeItem("reset_password_email");
      sessionStorage.removeItem("reset_password_token");

      if (loginResult?.ok) {
        router.push("/");
      } else {
        toast({
          title: "⚠️ Reset Berhasil",
          description: "Password berhasil direset. Silakan login untuk melanjutkan.",
        });
        router.push("/auth/login");
      }
    } catch (error) {
      console.error("Reset password error:", error);
      toast({
        title: "❌ Reset Gagal",
        description:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat reset password. Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md mx-auto">
        <Card className="w-full dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              {isRequesting ? (
                <Mail className="w-6 h-6 text-red-600 dark:text-red-400" />
              ) : (
                <Lock className="w-6 h-6 text-red-600 dark:text-red-400" />
              )}
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-50">
              {isRequesting ? "Reset Password" : "Set Password Baru"}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              {isRequesting ? (
                <>
                  Masukkan email Anda untuk menerima kode OTP reset password
                  <br />
                  <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2 block">
                    Kami akan mengirim kode OTP ke email Anda
                  </span>
                </>
              ) : (
                <>
                  Reset password untuk <br />
                  <span className="font-semibold text-blue-600 dark:text-blue-400 break-all">
                    {email}
                  </span>
                  <br />
                  <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2 block">
                    Masukkan password baru Anda
                  </span>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={isRequesting ? handleRequestReset : handleResetPassword}>
              <div className="flex flex-col gap-6">
                {isRequesting ? (
                  <>
                    <div className="grid gap-3">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="Masukkan email Anda"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {loading ? "Mengirim..." : "Kirim Kode OTP"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid gap-3">
                      <Label htmlFor="newPassword">Password Baru</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                        <Input
                          id="newPassword"
                          type={showPassword ? "text" : "password"}
                          placeholder="Masukkan password baru"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="pl-10 pr-10"
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
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                      <Button type="submit" className="w-full" disabled={loading || !newPassword || !confirmPassword}>
                        {loading && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {loading ? "Mereset Password..." : "Reset Password"}
                      </Button>
                    </div>
                  </>
                )}

                <div className="text-center px-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.push("/auth/login")}
                    className="text-xs sm:text-sm text-gray-600 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300 w-full sm:w-auto"
                  >
                    ← Kembali ke login
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
