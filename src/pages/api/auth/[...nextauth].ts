import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { login } from "@/lib/api";

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
          // Validate credentials
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          // Use API client to call backend
          // login() now returns null on error instead of throwing
          const authResponse = await login({
            email: credentials.email,
            password: credentials.password,
          });

          // Check if login failed (null response)
          if (!authResponse) {
            return null;
          }

          // Extract data from response
          const accessToken = authResponse.access_token;
          const refreshToken = authResponse.refresh_token;
          const userData = authResponse.user;

          // Validate required fields
          if (!accessToken || !userData) {
            return null;
          }

          // Return user object for successful login
          return {
            id: userData.id || "",
            email: userData.email || credentials.email,
            name: userData.full_name || userData.email?.split("@")[0] || "Admin",
            image: userData.profile_photo || "",
            accessToken: accessToken,
            refreshToken: refreshToken || accessToken + "_refresh",
            isVerified: userData.is_verified ?? true,
            userType: userData.user_type || "admin",
            loginType: userData.login_type || "credential",
          };
        } catch {
          // Catch all errors and return null (never throw)
          // This should never happen now since login() returns null on error
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in - store user data in token
      if (account && user) {
        token.sub = user.id;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.isVerified = user.isVerified;
        token.userType = user.userType;
        token.loginType = user.loginType;
        token.image = user.image;
        token.name = user.name;
        token.email = user.email;
        token.accessTokenExpires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
      }
      return token;
    },
    async session({ session, token }) {
      // Add user data to session
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.name = (token.name as string) || session.user.name || "";
        session.user.email = (token.email as string) || session.user.email || "";
        session.user.image = (token.image as string) || session.user.image || undefined;
      }
      // Add custom fields to session
      session.accessToken = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      session.isVerified = token.isVerified as boolean;
      session.userType = token.userType as string;
      session.loginType = token.loginType as string;
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // Update session every 24 hours
  },
  jwt: {
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production", // HTTPS only in production
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: false,
};

export default NextAuth(authOptions);