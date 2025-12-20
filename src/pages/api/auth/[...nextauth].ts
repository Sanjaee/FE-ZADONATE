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
          console.log("🔐 Response text preview:", responseText.substring(0, 300));
          
          // Check if response is HTML error page (starts with "Internal Server Error" or HTML tags)
          const trimmedResponse = responseText.trim();
          if (trimmedResponse.startsWith("Internal Server Error") || 
              trimmedResponse.startsWith("<!DOCTYPE") || 
              trimmedResponse.startsWith("<html") ||
              contentType.includes("text/html")) {
            console.error("🔐 Backend returned HTML error page instead of JSON");
            console.error("🔐 Full response:", responseText.substring(0, 500));
            // Return null instead of throwing to prevent 500 error
            return null;
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
                errorMessage = `Backend returned non-JSON error. Status: ${response.status}`;
              }
            } else {
              // If not JSON, it's probably HTML error page or plain text
              console.error("🔐 Backend returned non-JSON response");
              errorMessage = `Backend error (${response.status}). Please check backend URL configuration.`;
            }
            
            console.error("🔐 Login failed:", errorMessage);
            // Return null instead of throwing to prevent 500 error
            return null;
          }

          // Validate content type before parsing
          if (!contentType.includes("application/json")) {
            console.error("🔐 Backend returned non-JSON response for successful request");
            console.error("🔐 Content-Type:", contentType);
            console.error("🔐 Response text:", responseText.substring(0, 300));
            // Return null instead of throwing
            return null;
          }

          // Parse JSON response
          let authResponse;
          try {
            authResponse = JSON.parse(responseText);
          } catch (e) {
            console.error("🔐 Failed to parse response JSON:", e);
            console.error("🔐 Response text:", responseText);
            // Return null instead of throwing
            return null;
          }

          if (!authResponse.success) {
            throw new Error(authResponse.error || "Login failed");
          }

          // Validate required fields
          if (!authResponse.user || !authResponse.user.id || !authResponse.access_token) {
            console.error("🔐 Invalid response format - missing required fields:", {
              hasUser: !!authResponse.user,
              hasUserId: !!authResponse.user?.id,
              hasAccessToken: !!authResponse.access_token,
            });
            throw new Error("Invalid response format from backend: missing required fields");
          }

          const userData = {
            id: authResponse.user.id,
            email: authResponse.user.email || credentials.email,
            name: authResponse.user.full_name || "Admin",
            image: "",
            accessToken: authResponse.access_token,
            refreshToken: authResponse.refresh_token || authResponse.access_token + "_refresh",
            isVerified: authResponse.user.is_verified !== undefined ? authResponse.user.is_verified : true,
            userType: authResponse.user.user_type || "admin",
            loginType: authResponse.user.login_type || "credential",
          };

          console.log("🔐 Login successful, user data:", {
            id: userData.id,
            email: userData.email,
            hasAccessToken: !!userData.accessToken,
          });

          return userData;
        } catch (error) {
          console.error("🔐 Authentication error:", error);
          console.error("🔐 Error stack:", error instanceof Error ? error.stack : "No stack trace");
          
          // Don't throw error - return null to let NextAuth handle it gracefully
          // Throwing error causes "Callback for provider type credentials not supported"
          if (error instanceof Error) {
            // Log the error for debugging
            let errorMessage = error.message || "Login failed. Please check your credentials and backend configuration.";
            
            // Provide more specific error messages
            if (errorMessage.includes("Cannot connect to backend") || errorMessage.includes("Network error")) {
              errorMessage = `Backend connection failed. Please ensure BACKEND_URL is configured correctly in environment variables.`;
            }
            
            console.error("🔐 Returning null due to error:", errorMessage);
          }
          
          // Return null instead of throwing - this allows NextAuth to return proper error
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      try {
        // For credentials provider, always allow sign in if user object exists
        if (account?.provider === "credentials") {
          if (user) {
            console.log("🔐 SignIn callback - credentials provider, user exists");
            return true;
          }
          // If no user, deny sign in
          console.log("🔐 SignIn callback - credentials provider, no user object");
          return false;
        }
        // For other providers, allow sign in
        return true;
      } catch (error) {
        console.error("🔐 SignIn callback error:", error);
        return false;
      }
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
        console.error("🔐 Session callback error:", error);
        console.error("🔐 Session callback error stack:", error instanceof Error ? error.stack : "No stack");
        // Don't throw - return session with available data to prevent 500 error
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
  secret: process.env.NEXTAUTH_SECRET || "K1E90c5WRly4i69szH9xjkUF-0rDM-tl3WKA06hMayTBDvuOmjjsj3z_i_f7NIFk",
  debug: process.env.NODE_ENV === "development",
  // Ensure NEXTAUTH_URL is set for production
  ...(process.env.NEXTAUTH_URL && { url: process.env.NEXTAUTH_URL }),
};


export default NextAuth(authOptions);
