import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";

// Get backend API URL from environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Interface for backend login response
interface BackendLoginResponse {
  success: boolean;
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    is_verified: boolean;
    user_type: string;
    login_type: string;
  };
}

// Interface for backend error response
interface BackendErrorResponse {
  success: false;
  error: string;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "admin@donate.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        try {
          // Call backend login API
          const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          const data: BackendLoginResponse | BackendErrorResponse = await response.json();

          if (!response.ok || !data.success) {
            const errorMessage = "error" in data ? data.error : "Invalid email or password";
            throw new Error(errorMessage);
          }

          // Return user object with token
          if ("user" in data && data.user) {
            return {
              id: data.user.id,
              email: data.user.email,
              name: data.user.full_name,
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              userType: data.user.user_type,
              isVerified: data.user.is_verified,
            };
          }

          throw new Error("Invalid response from server");
        } catch (error) {
          // Log error for debugging (remove in production or use proper logging)
          console.error("Login error:", error);
          if (error instanceof Error) {
            throw error;
          }
          throw new Error("Failed to authenticate. Please try again.");
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
        token.userType = (user as any).userType;
        token.isVerified = (user as any).isVerified;
        token.accessTokenExpires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Access token has expired, try to update it (optional: implement refresh logic)
      // For now, we'll let the token expire and user needs to re-login
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      if (token) {
        (session as any).accessToken = token.accessToken;
        (session as any).refreshToken = token.refreshToken;
        (session as any).userType = token.userType;
        (session as any).isVerified = token.isVerified;
        if (session.user) {
          session.user.id = token.sub || "";
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login", // Error code passed in query string as ?error=
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  secret: process.env.NEXTAUTH_SECRET || "K1E90c5WRly4i69szH9xjkUF-0rDM-tl3WKA06hMayTBDvuOmjjsj3z_i_f7NIFk",
  debug: process.env.NODE_ENV === "development",
};

export default NextAuth(authOptions);

