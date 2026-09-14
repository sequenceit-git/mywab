import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/config/env';
import { supabase } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPass = String(password);

    // 1. Direct match with configured Admin credentials
    const isConfiguredAdmin =
      cleanEmail === env.auth.adminEmail.toLowerCase() &&
      cleanPass === env.auth.adminPassword;

    if (isConfiguredAdmin) {
      const response = NextResponse.json({
        success: true,
        user: {
          email: env.auth.adminEmail,
          name: 'Super Admin',
          role: 'ADMIN'
        }
      });

      // Set secure HTTP-only cookie
      const sessionData = JSON.stringify({
        email: env.auth.adminEmail,
        name: 'Super Admin',
        role: 'ADMIN',
        loginAt: Date.now()
      });

      const encoded = Buffer.from(sessionData).toString('base64');

      response.cookies.set('wap_auth_token', encoded, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      });

      return response;
    }

    // 2. Check Supabase Auth if configured
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPass
        });

        if (!error && data.user) {
          const response = NextResponse.json({
            success: true,
            user: {
              id: data.user.id,
              email: data.user.email,
              name: data.user.user_metadata?.full_name || 'Staff User',
              role: 'ADMIN'
            }
          });

          const sessionData = JSON.stringify({
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.full_name || 'Staff User',
            role: 'ADMIN',
            loginAt: Date.now()
          });

          const encoded = Buffer.from(sessionData).toString('base64');

          response.cookies.set('wap_auth_token', encoded, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7
          });

          return response;
        }
      } catch (authErr) {
        console.error('Supabase Auth error:', authErr);
      }
    }

    return NextResponse.json(
      { success: false, error: 'Invalid email or password' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error during authentication' },
      { status: 500 }
    );
  }
}
