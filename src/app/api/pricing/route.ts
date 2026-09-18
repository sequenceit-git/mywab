import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const [products, categories] = await Promise.all([
      db.getAllProducts(),
      db.getCategories()
    ]);

    // Calculate overall catalog stats
    const totalProducts = products.length;
    const totalPotentialRevenue = products.reduce((sum, p) => sum + p.price, 0);
    const totalBaseCost = products.reduce((sum, p) => sum + p.basePrice, 0);
    const totalProfit = Math.max(0, totalPotentialRevenue - totalBaseCost);
    const avgMarginPercent = totalPotentialRevenue > 0 ? Math.round((totalProfit / totalPotentialRevenue) * 100) : 0;
    const avgProfitPerUnit = totalProducts > 0 ? Math.round(totalProfit / totalProducts) : 0;

    return NextResponse.json({
      success: true,
      stats: {
        totalProducts,
        totalPotentialRevenue,
        totalBaseCost,
        totalProfit,
        avgMarginPercent,
        avgProfitPerUnit
      },
      products,
      categories
    });
  } catch (error) {
    console.error('Error fetching pricing catalog:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, price, basePrice, name, description } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Package ID is required' }, { status: 400 });
    }

    const updated = await db.updatePackage(id, {
      price: price !== undefined ? Number(price) : undefined,
      basePrice: basePrice !== undefined ? Number(basePrice) : undefined,
      name: name ? String(name) : undefined,
      description: description ? String(description) : undefined
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Package not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, product: updated });
  } catch (error) {
    console.error('Error updating pricing package:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.action === 'reset') {
      await db.resetToDefaults();
      return NextResponse.json({ success: true, message: 'All package prices reset to factory defaults' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in pricing action:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
