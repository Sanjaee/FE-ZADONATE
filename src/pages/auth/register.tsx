import { useState } from "react";
import { useRouter } from "next/router";
import { signIn } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState<RegisterFormData>({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.username.trim()) {
      toast({
        title: "Error",
        description: "Username is required",
        variant: "destructive",
      });
      return false;
    }
    if (formData.username.length < 3) {
      toast({
        title: "Error",
        description: "Username must be at least 3 characters long",
        variant: "destructive",
      });
      return false;
    }
    if (formData.username.length > 50) {
      toast({
        title: "Error",
        description: "Username must be maximum 50 characters long",
        variant: "destructive",
      });
      return false;
    }
    if (!formData.email.trim()) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive",
      });
      return false;
    }
    if (!formData.email.includes("@")) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return false;
    }
    if (!formData.password) {
      toast({
        title: "Error",
        description: "Password is required",
        variant: "destructive",
      });
      return false;
    }
    if (formData.password.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const data = await api.register({
        full_name: formData.username,
        email: formData.email,
        password: formData.password,
        user_type: "member",
      });

      // Store email in session storage
      sessionStorage.setItem("registration_email", formData.email);
      
      // Check if verification is required
      if (data.requires_verification) {
        toast({
          title: "✅ Pendaftaran Berhasil!",
          description: "OTP telah dikirim ke email Anda. Silakan verifikasi email untuk melanjutkan.",
        });
        
        // Always redirect to verify-otp page for OTP input
        router.push(`/auth/verify-otp?email=${encodeURIComponent(formData.email)}`);
      } else {
        // User already verified (shouldn't happen for new registration)
        toast({
          title: "✅ Pendaftaran Berhasil!",
          description: "Akun berhasil dibuat. Silakan login.",
        });
        router.push("/auth/login");
      }
    } catch (error) {
      console.error("Registration error:", error);

      let errorTitle = "❌ Pendaftaran Gagal";
      let errorDescription = "Terjadi kesalahan saat mendaftar. Silakan coba lagi.";

      // Handle specific error cases
      if (error instanceof Error) {
        const errorMessage = error.message || "";
        
        // Check for specific error messages
        if (errorMessage.includes("already registered with Google") || 
            errorMessage.includes("already registered with password")) {
          errorTitle = "❌ Email Sudah Terdaftar";
          errorDescription = errorMessage.includes("Google") 
            ? "Email ini sudah terdaftar dengan Google. Silakan login menggunakan Google Sign In."
            : "Email ini sudah terdaftar dengan password. Silakan login dengan email dan password.";
        } else if (errorMessage.includes("already registered") || 
                   errorMessage.includes("already exists")) {
          errorTitle = "❌ Email Sudah Terdaftar";
          errorDescription = "Email yang Anda gunakan sudah terdaftar. Silakan gunakan yang lain atau coba login.";
        } else if (errorMessage.includes("username already taken")) {
          errorTitle = "❌ Username Sudah Digunakan";
          errorDescription = "Username yang Anda pilih sudah digunakan. Silakan pilih username lain.";
        } else if (errorMessage.includes("Invalid request data") || 
                   errorMessage.includes("VALIDATION_ERROR")) {
          errorTitle = "❌ Data Tidak Valid";
          errorDescription = "Pastikan semua field diisi dengan benar. Username min 3 karakter, password min 8 karakter.";
        } else if (typeof errorMessage === 'string' && errorMessage.trim() !== '') {
          // Use the error message if it's a valid string
          errorDescription = errorMessage;
        }
      }

      // Handle object errors (fallback)
      if (typeof error === 'object' && error !== null && !(error instanceof Error)) {
        const errorObj = error as {
          response?: {
            data?: {
              error?: {
                message?: string;
              };
            };
          };
          message?: string;
        };
        if (errorObj.response?.data?.error?.message) {
          errorDescription = errorObj.response.data.error.message;
        } else if (errorObj.message) {
          errorDescription = typeof errorObj.message === 'string' ? errorObj.message : errorDescription;
        }
      }

      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl: "/" });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* Back Button */}
      <div className="absolute top-4 left-4 md:top-6 md:left-6 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
      </div>
      <div className={cn("flex flex-col gap-6")}>
        <Card className="w-full max-w-md mx-auto dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-gray-900 dark:text-gray-50">
              Template Zacode
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Buat akun baru untuk memulai
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-3">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="Masukkan username (min 3, max 50 karakter)"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                    minLength={3}
                    maxLength={50}
                  />
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Masukkan email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Masukkan password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Konfirmasi password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      required
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Membuat Akun..." : "Buat Akun"}
                  </Button>
                </div>
              </div>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-gray-800 px-2 text-muted-foreground">
                  Atau lanjutkan dengan
                </span>
              </div>
            </div>

            {/* Google Sign Up Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
            >
              <svg
                className="mr-2 h-4 w-4"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {googleLoading ? "Memproses..." : "Daftar dengan Google"}
            </Button>

            {/* Login Link */}
            <div className="text-center mt-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sudah punya akun?{" "}
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                  onClick={() => router.push("/auth/login")}
                >
                  Masuk di sini
                </Button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
