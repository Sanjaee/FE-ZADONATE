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
          const authResponse = await login({
            email: credentials.email,
            password: credentials.password,
          });

          // Extract data from response
          const accessToken = authResponse.access_token;
          const refreshToken = authResponse.refresh_token;
          const userData = authResponse.user;

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
          // API client handles all error cases internally
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn() {
      // Only credentials provider, no Google OAuth
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      // Initial sign in
      if (account && user) {
        return {
          ...token,
          sub: user.id,
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          isVerified: user.isVerified,
          userType: user.userType,
          loginType: user.loginType,
          image: user.image,
          accessTokenExpires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days (matches backend JWT expiration)
        };
      }

      // Handle session update trigger (when update() is called)
      if (trigger === "update" && token.accessToken) {
        try {
          // Use API client to fetch updated user data
          const { getCurrentUser } = await import("@/lib/api");
          const updatedUser = await getCurrentUser(token.accessToken as string);
          
          if (updatedUser) {
            return {
              ...token,
              image: updatedUser.profile_photo || token.image || "",
              name: updatedUser.full_name || token.name || "",
            };
          }
        } catch {
          // Continue with existing token if fetch fails
        }
      }

      // Return previous token if the access token has not expired yet
      if (token.accessTokenExpires && Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Access token has expired, try to update it
      const refreshed = await refreshAccessToken(token);
      
      // Ensure all required JWT fields are present
      return {
        ...token,
        ...refreshed,
        sub: token.sub || "",
      } as typeof token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        // Prioritize token.image over session.user.image
        session.user.image = (token.image as string) || session.user.image || undefined;
        session.user.name = (token.name as string) || session.user.name || "";
        session.user.role = token.userType as string; // Add role alias
        session.user.username = (token.name as string) || session.user.name; // Add username alias
      }
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
  },
  jwt: {
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: false,
};

async function refreshAccessToken(token: {
  refreshToken?: string;
  accessTokenExpires?: number;
  [key: string]: unknown;
}) {
  try {
    if (!token.refreshToken) {
      return {
        ...token,
        error: "RefreshAccessTokenError",
      };
    }

    // Backend might not have refresh token endpoint, so try to refresh
    // If it fails, return error to force re-login
    try {
      const { refreshToken: refreshTokenApi } = await import("@/lib/api");
      const refreshedTokens = await refreshTokenApi(token.refreshToken as string);

      if (!refreshedTokens || !refreshedTokens.access_token) {
        return {
          ...token,
          error: "RefreshAccessTokenError",
        };
      }

      return {
        ...token,
        accessToken: refreshedTokens.access_token,
        accessTokenExpires: Date.now() + (refreshedTokens.expires_in || 7 * 24 * 60 * 60) * 1000,
        refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
        isVerified: refreshedTokens.user?.is_verified ?? token.isVerified ?? true,
        userType: refreshedTokens.user?.user_type ?? token.userType ?? "admin",
        loginType: refreshedTokens.user?.login_type ?? token.loginType ?? "credential",
        image: refreshedTokens.user?.profile_photo || token.image || "",
      };
    } catch {
      // If refresh fails, return error to force re-login
      return {
        ...token,
        error: "RefreshAccessTokenError",
      };
    }
  } catch {
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export default NextAuth(authOptions);