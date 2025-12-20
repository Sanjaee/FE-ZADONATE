import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Validate required environment variables
if (!process.env.NEXTAUTH_SECRET) {
  console.error("⚠️ NEXTAUTH_SECRET is not set. Please set it in your environment variables.");
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          // Call backend login API
          // Use BACKEND_URL for server-side (NextAuth runs on server), NEXT_PUBLIC_API_URL as fallback
          const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
          const loginUrl = `${backendUrl}/api/v1/auth/login`;
          
          console.log("🔐 Attempting login to:", loginUrl);
          console.log("🔐 Backend URL env:", {
            BACKEND_URL: process.env.BACKEND_URL ? `set (${process.env.BACKEND_URL.substring(0, 20)}...)` : "not set",
            NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ? `set (${process.env.NEXT_PUBLIC_API_URL.substring(0, 20)}...)` : "not set",
            NODE_ENV: process.env.NODE_ENV,
          });
          
          let response: Response;
          try {
            response = await fetch(loginUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
              }),
            });
          } catch (fetchError) {
            console.error("🔐 Fetch error:", fetchError);
            const errorMessage = fetchError instanceof Error ? fetchError.message : "Unknown fetch error";
            
            // Check if it's a network error
            if (errorMessage.includes("fetch failed") || errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND")) {
              throw new Error(`Cannot connect to backend at ${backendUrl}. Please check BACKEND_URL environment variable.`);
            }
            
            throw new Error(`Network error: ${errorMessage}. Please check backend URL configuration.`);
          }
          
          console.log("🔐 Login response status:", response.status, response.statusText);
          console.log("🔐 Login response headers:", Object.fromEntries(response.headers.entries()));
          
          // Get response text first to check content type
          const responseText = await response.text();
          const contentType = response.headers.get("content-type") || "";
          
          console.log("🔐 Response content-type:", contentType);
          console.log("🔐 Response text preview:", responseText.substring(0, 200));
          
          if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            
            // Try to parse as JSON if content-type indicates JSON
            if (contentType.includes("application/json")) {
              try {
                const errorData = JSON.parse(responseText);
                errorMessage = errorData.error || errorMessage;
              } catch (e) {
                console.error("🔐 Failed to parse error JSON:", e);
                errorMessage = `Backend returned non-JSON error. Status: ${response.status}`;
              }
            } else {
              // If not JSON, it's probably HTML error page
              console.error("🔐 Backend returned non-JSON response (likely HTML error page)");
              errorMessage = `Backend error (${response.status}). Please check backend URL configuration.`;
            }
            
            console.error("🔐 Login failed:", errorMessage);
            throw new Error(errorMessage);
          }

          // Parse JSON response
          let authResponse;
          try {
            authResponse = JSON.parse(responseText);
          } catch (e) {
            console.error("🔐 Failed to parse response JSON:", e);
            console.error("🔐 Response text:", responseText);
            throw new Error("Backend returned invalid JSON response. Please check backend configuration.");
          }

          if (!authResponse.success) {
            throw new Error(authResponse.error || "Login failed");
          }

          return {
            id: authResponse.user.id,
            email: authResponse.user.email,
            name: authResponse.user.full_name,
            image: "",
            accessToken: authResponse.access_token,
            refreshToken: authResponse.refresh_token,
            isVerified: authResponse.user.is_verified,
            userType: authResponse.user.user_type,
            loginType: authResponse.user.login_type,
          };
        } catch (error) {
          console.error("🔐 Authentication error:", error);
          console.error("🔐 Error stack:", error instanceof Error ? error.stack : "No stack trace");
          
          if (error instanceof Error) {
            // Return more user-friendly error message
            let errorMessage = error.message || "Login failed. Please check your credentials and backend configuration.";
            
            // Provide more specific error messages
            if (errorMessage.includes("Cannot connect to backend") || errorMessage.includes("Network error")) {
              errorMessage = `Backend connection failed. Please ensure BACKEND_URL is configured correctly in environment variables. Current URL: ${process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "not set"}`;
            }
            
            throw new Error(errorMessage);
          }
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn() {
      return true;
    },
    async jwt({ token, user }) {
      // Initial sign in
      if (user) {
        return {
          ...token,
          sub: user.id,
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          isVerified: user.isVerified,
          userType: user.userType,
          loginType: user.loginType,
          image: user.image,
        };
      }
      return token;
    },
    async session({ session, token }) {
      try {
        if (session.user) {
          session.user.id = (token.sub as string) || "";
          // Prioritize token.image over session.user.image
          session.user.image = (token.image as string) || session.user.image || undefined;
          session.user.name = (token.name as string) || session.user.name || "";
          session.user.role = (token.userType as string) || ""; // Add role alias
          session.user.username = (token.name as string) || session.user.name || ""; // Add username alias
        }
        session.accessToken = (token.accessToken as string) || "";
        session.refreshToken = (token.refreshToken as string) || "";
        session.isVerified = (token.isVerified as boolean) || false;
        session.userType = (token.userType as string) || "";
        session.loginType = (token.loginType as string) || "";
        return session;
      } catch (error) {
        console.error("Session callback error:", error);
        throw error;
      }
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl + "/donate/history";
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  jwt: {
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-key-change-in-production",
  debug: process.env.NODE_ENV === "development",
  // Ensure NEXTAUTH_URL is set for production
  ...(process.env.NEXTAUTH_URL && { url: process.env.NEXTAUTH_URL }),
};


export default NextAuth(authOptions);
