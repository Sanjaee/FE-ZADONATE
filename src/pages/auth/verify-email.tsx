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
import { toast } from "@/hooks/use-toast";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

export default function VerifyEmail() {
  const router = useRouter();
  const { token, email, type } = router.query;
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [isResetPassword, setIsResetPassword] = useState(false);

  useEffect(() => {
    if (router.isReady) {
      // Check if this is a reset password token (from URL path or query param)
      const pathname = router.pathname;
      const queryType = router.query.type as string;
      
      setIsResetPassword(
        queryType === "reset" || 
        pathname.includes("reset") || 
        sessionStorage.getItem("reset_password_email") !== null
      );

      const emailFromQuery = router.query.email as string;
      const emailFromStorage = sessionStorage.getItem(
        isResetPassword ? "reset_password_email" : "registration_email"
      );

      if (emailFromQuery) {
        setUserEmail(emailFromQuery);
      } else if (emailFromStorage) {
        setUserEmail(emailFromStorage);
      }

      // Auto verify if token exists
      if (token && typeof token === "string") {
        handleVerifyEmail(token, isResetPassword);
      } else if (!token && router.isReady) {
        // No token, redirect to appropriate page
        if (isResetPassword) {
          router.push("/auth/reset-password");
        } else {
          router.push("/auth/register");
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, token, email, type]);

  const handleVerifyEmail = async (verificationToken: string, isReset: boolean) => {
    if (!verificationToken) {
      toast({
        title: "❌ Token Tidak Valid",
        description: "Token verifikasi tidak ditemukan.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (isReset) {
        // For reset password: verify token and redirect to reset password page
        // Token verification not needed, proceed directly

        // Store token in session for reset password page
        sessionStorage.setItem("reset_password_token", verificationToken);
        
        toast({
          title: "✅ Token Valid!",
          description: "Silakan masukkan password baru Anda.",
        });

        // Redirect to reset password page
        router.push(`/auth/reset-password?token=${verificationToken}&email=${encodeURIComponent(userEmail)}`);
      } else {
        // For email verification: verify and auto login
        const response = await api.verifyEmail(verificationToken);

        // Auto login using JWT tokens from response
        if (response.user && response.access_token) {
          const loginResult = await signIn("credentials", {
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            redirect: false,
          });

          if (loginResult?.ok) {
            setVerified(true);
            toast({
              title: "🎉 Email Berhasil Diverifikasi!",
              description: "Akun Anda telah diverifikasi. Anda akan diarahkan ke halaman utama...",
            });

            // Clear session storage
            sessionStorage.removeItem("registration_email");
            sessionStorage.removeItem("reset_password_email");

            // Redirect after short delay
            setTimeout(() => {
              router.push("/");
            }, 1500);
          } else {
            toast({
              title: "⚠️ Verifikasi Berhasil",
              description:
                "Email berhasil diverifikasi. Silakan login untuk melanjutkan.",
            });
            router.push("/auth/login");
          }
        }
      }
    } catch (error) {
      console.error("Verification error:", error);

      let errorMessage = "Token tidak valid atau sudah kedaluwarsa. Silakan request ulang.";

      if (error instanceof Error) {
        const errorObj = error as unknown as { 
          response?: { 
            data?: { 
              error?: { message?: string } 
            } 
          } 
        };
        if (errorObj.response?.data?.error?.message) {
          errorMessage = errorObj.response.data.error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
      }

      toast({
        title: "❌ Verifikasi Gagal",
        description: errorMessage,
        variant: "destructive",
      });

      // Redirect to appropriate page based on type
      if (isReset) {
        router.push("/auth/reset-password");
      } else {
        router.push("/auth/register");
      }
    } finally {
      setLoading(false);
    }
  };

  if (verified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md mx-auto">
          <Card className="w-full dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-50">
                Email Terverifikasi!
              </CardTitle>
              <CardDescription className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                Email Anda telah berhasil diverifikasi. Mengarahkan ke halaman utama...
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md mx-auto">
        <Card className="w-full dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
              {loading ? (
                <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
              ) : (
                <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-50">
              {isResetPassword
                ? "Verifikasi Reset Password"
                : "Verifikasi Email"}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              {loading ? (
                "Memverifikasi email Anda..."
              ) : userEmail ? (
                <>
                  Memverifikasi email{" "}
                  <span className="font-semibold text-blue-600 dark:text-blue-400 break-all">
                    {userEmail}
                  </span>
                </>
              ) : (
                "Memverifikasi email Anda"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!token && (
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Token verifikasi tidak ditemukan.
                </p>
                <Button
                  onClick={() => {
                    if (isResetPassword) {
                      router.push("/auth/reset-password");
                    } else {
                      router.push("/auth/register");
                    }
                  }}
                >
                  Kembali
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

