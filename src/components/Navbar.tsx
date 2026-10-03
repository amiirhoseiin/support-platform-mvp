'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserProfile } from '@/types/database';
import { LogOut, LifeBuoy, ShieldCheck, User } from 'lucide-react';

interface NavbarProps {
  user: UserProfile;
}

export function Navbar({ user }: NavbarProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'founder':
        return 'purple' as const;
      case 'agent':
        return 'default' as const;
      default:
        return 'secondary' as const;
    }
  };

  const getTierBadgeVariant = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'destructive' as const;
      case 'substantial':
        return 'warning' as const;
      default:
        return 'outline' as const;
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-xs">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link
            href={user.role === 'customer' ? '/customer' : '/agent'}
            className="flex items-center gap-2 font-semibold text-zinc-900"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white shadow-xs">
              <LifeBuoy className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight">SaaS Support</span>
          </Link>

          <nav className="hidden md:flex items-center gap-4 text-sm font-medium">
            {user.role === 'customer' ? (
              <Link
                href="/customer"
                className="text-zinc-600 transition-colors hover:text-zinc-950 font-medium"
              >
                My Tickets
              </Link>
            ) : (
              <>
                <Link
                  href="/agent"
                  className="text-zinc-600 transition-colors hover:text-zinc-950 font-medium"
                >
                  Unified Queue
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-900">{user.name}</span>
              <Badge variant={getRoleBadgeVariant(user.role)} className="capitalize">
                {user.role}
              </Badge>
              {user.role === 'customer' && (
                <Badge variant={getTierBadgeVariant(user.tier)} className="capitalize">
                  {user.tier} Tier
                </Badge>
              )}
            </div>
            <span className="text-xs text-zinc-500">{user.email}</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-zinc-600 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

