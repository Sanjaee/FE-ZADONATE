import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id?: string;
    accessToken?: string;
    refreshToken?: string;
    isVerified?: boolean;
    userType?: string;
    loginType?: string;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      username?: string;
    };
    accessToken?: string;
    refreshToken?: string;
    isVerified?: boolean;
    userType?: string;
    loginType?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    isVerified?: boolean;
    userType?: string;
    loginType?: string;
    accessTokenExpires?: number;
  }
}

