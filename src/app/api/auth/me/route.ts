import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('wap_auth_token')?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    return NextResponse.json({
      authenticated: true,
      user: {
        email: decoded.email,
        name: decoded.name,
        role: decoded.role || 'ADMIN'
      }
    });
  } catch (err) {
    return NextResponse.json({ authenticated: false, user: null });
  }
}
