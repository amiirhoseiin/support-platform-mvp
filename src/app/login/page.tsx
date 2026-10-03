'use client';

import * as React from 'react';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { LifeBuoy, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single();

      const userRole = profile?.role;

      if (redirectTo) {
        router.push(redirectTo);
      } else if (userRole === 'customer') {
        router.push('/customer');
      } else {
        router.push('/agent');
      }
      router.refresh();
    } else {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('demo123');
  };

  return (
    <Card className="shadow-md border-zinc-200">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Sign In</CardTitle>
        <CardDescription>Enter your email and password to access your account</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-700" htmlFor="email">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-700" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full flex items-center justify-center gap-2" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 border-t border-zinc-100 bg-zinc-50/50 pt-4">
        <div className="w-full">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Demo Accounts (Password: demo123)
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleQuickLogin('cto@acmecorp.com')}
              className="flex flex-col items-start p-2 rounded border border-zinc-200 bg-white hover:bg-zinc-100 transition-colors text-left"
            >
              <span className="font-semibold text-zinc-800">Acme Corp</span>
              <span className="text-[10px] text-zinc-500">Customer (Enterprise)</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin@novintech.ir')}
              className="flex flex-col items-start p-2 rounded border border-zinc-200 bg-white hover:bg-zinc-100 transition-colors text-left"
            >
              <span className="font-semibold text-zinc-800">Novin Tech</span>
              <span className="text-[10px] text-zinc-500">Customer (Substantial)</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('mike@company.com')}
              className="flex flex-col items-start p-2 rounded border border-zinc-200 bg-white hover:bg-zinc-100 transition-colors text-left"
            >
              <span className="font-semibold text-zinc-800">Mike Support</span>
              <span className="text-[10px] text-zinc-500">Staff (Agent)</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('founder@company.com')}
              className="flex flex-col items-start p-2 rounded border border-zinc-200 bg-white hover:bg-zinc-100 transition-colors text-left"
            >
              <span className="font-semibold text-zinc-800">Sarah</span>
              <span className="text-[10px] text-zinc-500">Staff (Founder)</span>
            </button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-md">
            <LifeBuoy className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">B2B SaaS Support</h1>
          <p className="text-sm text-zinc-500">Sign in to your customer portal or staff queue</p>
        </div>

        <Suspense fallback={<div className="p-8 text-center text-sm text-zinc-400">Loading form...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
