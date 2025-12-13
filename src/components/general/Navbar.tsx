"use client";

import React from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, User, Settings } from "lucide-react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isLoading = status === "loading";

  const handleSignIn = () => {
    signIn(undefined, { callbackUrl: router.asPath });
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo/Brand */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 font-semibold text-lg hover:opacity-80 transition-opacity"
          >
            Zacode
          </button>
        </div>

        {/* Right side - Auth buttons */}
        <div className="flex items-center gap-4">
          {isLoading ? (
            <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
          ) : session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                  <Avatar className="h-9 w-9 ring-2 ring-offset-2 ring-offset-background ring-ring">
                    <AvatarImage
                      src={session.user.image || undefined}
                      alt={session.user.name || "User"}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(session.user.name, session.user.email)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col space-y-1 p-0">
                  <div className="flex items-center gap-3 px-2 py-1.5">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={session.user.image || undefined}
                        alt={session.user.name || "User"}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(session.user.name, session.user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">
                        {session.user.name || "User"}
                      </span>
                      {session.user.email && (
                        <span className="text-xs font-normal text-muted-foreground">
                          {session.user.email}
                        </span>
                      )}
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push("/profile")}
                  className="cursor-pointer"
                >
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/settings")}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-destructive focus:text-destructive"
                  variant="destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={handleSignIn} variant="default">
              Sign In
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}

