import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

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
          // Regular login with email/password
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          // Get backend URL from environment variables
          const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
          
          // Call backend login endpoint directly
          const loginResponse = await fetch(`${backendUrl}/api/v1/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          // If login failed, return null (NextAuth will set result.error = "CredentialsSignin")
          if (!loginResponse.ok) {
            return null;
          }

          // Backend returns: { success, access_token, refresh_token, user }
          const authResponse = await loginResponse.json();

          // Handle backend response structure
          const accessToken = authResponse.access_token;
          const refreshToken = authResponse.refresh_token;
          const userData = authResponse.user;

          // If response is invalid, return null
          if (!accessToken || !userData) {
            return null;
          }

          // Return user object for successful login
          return {
            id: userData.id,
            email: userData.email,
            name: userData.full_name || userData.email.split("@")[0] || "Admin",
            image: userData.profile_photo || "",
            accessToken: accessToken,
            refreshToken: refreshToken,
            isVerified: userData.is_verified ?? true,
            userType: userData.user_type || "admin",
            loginType: userData.login_type || "credential",
          };
        } catch (error) {
          // Never throw errors in authorize() - always return null on failure
          // NextAuth will handle the error and set result.error appropriately
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
          // Fetch updated user data from backend
          const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://zoom.zacloth.com";
          const userResponse = await fetch(`${backendUrl}/api/v1/auth/me`, {
            headers: {
              Authorization: `Bearer ${token.accessToken}`,
            },
          });

          if (userResponse.ok) {
            const userData = await userResponse.json();
            const updatedUser = userData.data?.user || userData.user;
            if (updatedUser) {
              return {
                ...token,
                image: updatedUser.profile_photo || updatedUser.profilePic || token.image,
                // Update name/username if changed
                name: updatedUser.username || updatedUser.full_name || token.name,
              };
            }
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
      const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      
      // Try to refresh token (if endpoint exists)
      const refreshResponse = await fetch(`${backendUrl}/api/v1/auth/refresh-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refresh_token: token.refreshToken,
        }),
      });

      if (!refreshResponse.ok) {
        return {
          ...token,
          error: "RefreshAccessTokenError",
        };
      }

      const refreshedTokens = await refreshResponse.json();

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