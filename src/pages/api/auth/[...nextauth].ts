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
          
          // Get response text first to check content type
          const responseText = await response.text();
          const contentType = response.headers.get("content-type") || "";
          
          console.log("🔐 Response content-type:", contentType);
          console.log("🔐 Response text length:", responseText.length);
          console.log("🔐 Response text preview (first 500 chars):", responseText.substring(0, 500));
          
          // Check if response is HTML (error page) or plain text error
          const trimmedResponse = responseText.trim();
          const isHTML = contentType.includes("text/html") || 
                        trimmedResponse.startsWith("<!DOCTYPE") || 
                        trimmedResponse.startsWith("<html") ||
                        trimmedResponse.startsWith("<HTML");
          const isPlainTextError = trimmedResponse.startsWith("Internal Server Error") ||
                                  trimmedResponse.startsWith("INTERNAL SERVER ERROR") ||
                                  trimmedResponse.startsWith("Error") ||
                                  (contentType.includes("text/plain") && !contentType.includes("json"));
          
          if (isHTML || isPlainTextError) {
            console.error("🔐 Backend returned non-JSON response (HTML or plain text error)");
            console.error("🔐 Content-Type:", contentType);
            console.error("🔐 Response preview:", trimmedResponse.substring(0, 500));
            throw new Error(`Backend returned error page instead of JSON (${response.status}). This usually means: 1) Backend URL is incorrect (current: ${backendUrl}), 2) Backend is not accessible from Vercel, or 3) Backend has an internal error. Please check BACKEND_URL environment variable and ensure backend is running and accessible.`);
          }
          
          if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            
            // Try to parse as JSON if content-type indicates JSON
            if (contentType.includes("application/json")) {
              try {
                const errorData = JSON.parse(responseText);
                errorMessage = errorData.error || errorMessage;
              } catch (e) {
                console.error("🔐 Failed to parse error JSON:", e);
                console.error("🔐 Error response text:", responseText);
                errorMessage = `Backend returned non-JSON error. Status: ${response.status}. Response: ${responseText.substring(0, 200)}`;
              }
            } else {
              // If not JSON, it's probably HTML error page or plain text
              console.error("🔐 Backend returned non-JSON response");
              console.error("🔐 Response text:", responseText);
              errorMessage = `Backend error (${response.status}). Response: ${responseText.substring(0, 200)}. Please check backend URL configuration: ${backendUrl}`;
            }
            
            console.error("🔐 Login failed:", errorMessage);
            throw new Error(errorMessage);
          }

          // Validate content type before parsing
          if (!contentType.includes("application/json")) {
            console.error("🔐 Backend returned non-JSON response for successful request");
            console.error("🔐 Content-Type:", contentType);
            console.error("🔐 Response text:", responseText);
            throw new Error(`Backend returned non-JSON response. Content-Type: ${contentType}. Please check backend configuration.`);
          }

          // Parse JSON response
          let authResponse;
          try {
            authResponse = JSON.parse(responseText);
          } catch (e) {
            console.error("🔐 Failed to parse response JSON:", e);
            console.error("🔐 Response text:", responseText);
            console.error("🔐 Response length:", responseText.length);
            throw new Error(`Backend returned invalid JSON response. Error: ${e instanceof Error ? e.message : "Unknown error"}. Response preview: ${responseText.substring(0, 200)}`);
          }

          if (!authResponse.success) {
            throw new Error(authResponse.error || "Login failed");
          }

          // Validate required fields
          if (!authResponse.user) {
            console.error("🔐 Missing user object in response:", authResponse);
            throw new Error("Invalid response format: missing user object");
          }

          if (!authResponse.access_token) {
            console.error("🔐 Missing access_token in response:", authResponse);
            throw new Error("Invalid response format: missing access_token");
          }

          if (!authResponse.user.id) {
            console.error("🔐 Missing user.id in response:", authResponse);
            throw new Error("Invalid response format: missing user.id");
          }

          console.log("🔐 Login successful, user:", {
            id: authResponse.user.id,
            email: authResponse.user.email,
            userType: authResponse.user.user_type,
          });

          return {
            id: authResponse.user.id || "",
            email: authResponse.user.email || credentials.email,
            name: authResponse.user.full_name || "Admin",
            image: "",
            accessToken: authResponse.access_token,
            refreshToken: authResponse.refresh_token || authResponse.access_token + "_refresh",
            isVerified: authResponse.user.is_verified !== undefined ? authResponse.user.is_verified : true,
            userType: authResponse.user.user_type || "admin",
            loginType: authResponse.user.login_type || "credential",
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
      try {
        // Initial sign in
        if (user) {
          console.log("🔐 JWT callback - new user:", {
            id: user.id,
            email: user.email,
            hasAccessToken: !!user.accessToken,
          });
          return {
            ...token,
            sub: user.id || token.sub,
            accessToken: user.accessToken || token.accessToken,
            refreshToken: user.refreshToken || token.refreshToken,
            isVerified: user.isVerified !== undefined ? user.isVerified : token.isVerified,
            userType: user.userType || token.userType,
            loginType: user.loginType || token.loginType,
            image: user.image || token.image,
          };
        }
        return token;
      } catch (error) {
        console.error("🔐 JWT callback error:", error);
        return token;
      }
    },
    async session({ session, token }) {
      try {
        console.log("🔐 Session callback called:", {
          hasToken: !!token,
          hasAccessToken: !!token.accessToken,
          tokenSub: token.sub,
        });
        
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
        
        console.log("🔐 Session callback success:", {
          userId: session.user?.id,
          email: session.user?.email,
          hasAccessToken: !!session.accessToken,
        });
        
        return session;
      } catch (error) {
        console.error("🔐 Session callback error:", error);
        console.error("🔐 Session callback error stack:", error instanceof Error ? error.stack : "No stack");
        // Don't throw, return session with available data
        return session;
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
