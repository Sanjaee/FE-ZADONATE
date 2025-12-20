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
          // Use NEXT_PUBLIC_API_URL for client-side, or BACKEND_URL for server-side
          const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || "http://localhost:5000";
          const loginUrl = `${backendUrl}/api/v1/auth/login`;
          
          console.log("🔐 Attempting login to:", loginUrl);
          
          const response = await fetch(loginUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });
          
          console.log("🔐 Login response status:", response.status, response.statusText);
          
          if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
              const errorData = await response.json();
              errorMessage = errorData.error || errorMessage;
            } catch {
              const text = await response.text().catch(() => "");
              console.error("🔐 Login error response:", text);
            }
            console.error("🔐 Login failed:", errorMessage);
            throw new Error(errorMessage);
          }

          const authResponse = await response.json();

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
          console.error("Authentication error:", error);
          if (error instanceof Error) {
            throw error;
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
