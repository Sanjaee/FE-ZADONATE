// API Client for Backend Communication
// Handles both server-side (NextAuth) and client-side requests

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  access_token: string;
  refresh_token: string;
  expires_in?: number; // Optional: token expiration in seconds
  user: {
    id: string;
    email: string;
    full_name: string;
    is_verified: boolean;
    user_type: string;
    login_type: string;
    profile_photo?: string;
  };
}

interface ApiError {
  message: string;
  status?: number;
}

/**
 * Get backend URL based on environment
 * - Server-side: Use BACKEND_URL (internal) or NEXT_PUBLIC_BACKEND_URL
 * - Client-side: Use NEXT_PUBLIC_BACKEND_URL
 */
function getBackendUrl(): string {
  const isServer = typeof window === "undefined";
  
  if (isServer) {
    // Server-side: prefer BACKEND_URL for internal network access
    return (
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "http://localhost:5000"
    );
  } else {
    // Client-side: use public URL
    return (
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "http://localhost:5000"
    );
  }
}

/**
 * Make API request with proper error handling
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const backendUrl = getBackendUrl();
  const url = `${backendUrl}${endpoint}`;

  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    // Add timeout for fetch (10 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      ...config,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Check if response is OK
    if (!response.ok) {
      // Try to parse error message
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        }
      } catch {
        // If parsing fails, use default error message
      }

      const error: ApiError = {
        message: errorMessage,
        status: response.status,
      };
      throw error;
    }

    // Check Content-Type before parsing
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw {
        message: "Invalid response format",
        status: response.status,
      } as ApiError;
    }

    // Parse JSON response
    const data = await response.json();
    return data as T;
  } catch (error) {
    // Handle different error types
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw {
          message: "Request timeout. Please try again.",
          status: 408,
        } as ApiError;
      }
      throw {
        message: error.message || "Network error occurred",
        status: 0,
      } as ApiError;
    }
    throw error as ApiError;
  }
}

/**
 * Login API - Authenticate user with email and password
 */
export async function login(
  credentials: LoginRequest
): Promise<LoginResponse> {
  try {
    const response = await apiRequest<LoginResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: credentials.email.trim(),
        password: credentials.password,
      }),
    });

    // Validate response structure
    if (
      !response ||
      typeof response !== "object" ||
      !response.access_token ||
      typeof response.access_token !== "string" ||
      !response.user ||
      typeof response.user !== "object"
    ) {
      throw {
        message: "Invalid response from server",
        status: 500,
      } as ApiError;
    }

    return response;
  } catch (error) {
    // Re-throw with proper error handling
    throw error as ApiError;
  }
}

/**
 * Refresh token API (if available)
 */
export async function refreshToken(
  refreshToken: string
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/v1/auth/refresh-token", {
    method: "POST",
    body: JSON.stringify({
      refresh_token: refreshToken,
    }),
  });
}

/**
 * Get current user info (if endpoint exists)
 */
export async function getCurrentUser(
  accessToken: string
): Promise<LoginResponse["user"]> {
  const response = await apiRequest<{ user: LoginResponse["user"] }>(
    "/api/v1/auth/me",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return response.user;
}

// Export types
export type { LoginRequest, LoginResponse, ApiError };

