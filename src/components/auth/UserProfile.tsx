"use client";

import React from "react";
import { LogOut } from "lucide-react";
import { useSupabaseAuth } from "@/supabase/client-provider";
import { handleSignOut } from "@/lib/auth";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "../ui/skeleton";

function getDisplayName(user: any) {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "Користувач"
  );
}

function getAvatarUrl(user: any) {
  return (
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    user?.user_metadata?.avatar ||
    ""
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  return (initials || "U").toUpperCase();
}

export function UserProfile() {
  const { user, isLoading } = useSupabaseAuth();

  const onSignOut = async () => {
    await handleSignOut();
    // редірект нехай роблять guard/page effects
  };

  if (isLoading) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  if (!user) return null;

  const name = getDisplayName(user);
  const email = user.email ?? "";
  const avatarUrl = getAvatarUrl(user);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarUrl} alt={name} />
            <AvatarFallback>{getInitials(name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {email}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Вийти</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
