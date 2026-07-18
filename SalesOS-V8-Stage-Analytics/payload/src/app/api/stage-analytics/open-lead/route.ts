import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const id = Number(request.nextUrl.searchParams.get('id') || 0);
  const base = process.env.ODOO_URL?.replace(/\/$/, '');
  if (!base || !Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: 'Valid Odoo URL and lead ID are required.' }, { status: 400 });
  }
  return NextResponse.redirect(`${base}/web#id=${id}&model=crm.lead&view_type=form`);
}
