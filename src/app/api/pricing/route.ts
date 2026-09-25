import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toPublicPricingProduct } from '@/lib/db/repositories/pricing';
import { applyPresetAccountUpdate } from '@/lib/streaming-accounts';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('all') === 'true';

    const [products, categories] = await Promise.all([
      db.getAllProducts(includeInactive),
      db.getCategories(includeInactive)
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
      products: products.map(toPublicPricingProduct),
      categories
    });
  } catch (error) {
    console.error('Error fetching pricing catalog:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Reset catalog to factory defaults
    if (body.action === 'reset') {
      await db.resetToDefaults();
      return NextResponse.json({ success: true, message: 'All package prices reset to factory defaults' });
    }

    // 2. Create new package under a category
    const { categoryId, name, amount, price, basePrice, description } = body;
    const presetMerged = applyPresetAccountUpdate(undefined, body);
    const presetAccount =
      presetMerged === undefined || presetMerged === null ? undefined : presetMerged;

    if (!categoryId || !name || price === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Category ID, package name, and selling price are required'
      }, { status: 400 });
    }

    const numPrice = Number(price);
    const numBasePrice = basePrice !== undefined ? Number(basePrice) : Math.round(numPrice * 0.82);

    if (isNaN(numPrice) || numPrice < 0 || isNaN(numBasePrice) || numBasePrice < 0) {
      return NextResponse.json({
        success: false,
        error: 'Selling price and base price must be positive numbers'
      }, { status: 400 });
    }

    const newProduct = await db.createPackage({
      categoryId: String(categoryId),
      name: String(name),
      amount: String(amount || name),
      price: numPrice,
      basePrice: numBasePrice,
      description: description ? String(description) : undefined,
      presetAccount
    });

    return NextResponse.json({
      success: true,
      message: 'Package created successfully and synced with WhatsApp Bot!',
      product: toPublicPricingProduct(newProduct)
    }, { status: 201 });
  } catch (error) {
    console.error('Error in pricing POST action:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, amount, price, basePrice, description, isActive } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Package ID is required' }, { status: 400 });
    }

    const existing = await db.getProductById(String(id));
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Package not found' }, { status: 404 });
    }

    const presetUpdate = applyPresetAccountUpdate(existing.presetAccount, body);
    if (
      (body.presetEmail !== undefined ||
        body.presetPassword !== undefined ||
        body.presetAccount ||
        body.clearPresetAccount) &&
      presetUpdate === undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Preset account needs both email and password, or clear both fields.'
        },
        { status: 400 }
      );
    }

    const updatePayload: Parameters<typeof db.updatePackage>[1] = {
      name: name !== undefined ? String(name) : undefined,
      amount: amount !== undefined ? String(amount) : undefined,
      price: price !== undefined ? Number(price) : undefined,
      basePrice: basePrice !== undefined ? Number(basePrice) : undefined,
      description: description !== undefined ? String(description) : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined
    };

    if (presetUpdate !== undefined) {
      updatePayload.presetAccount = presetUpdate;
    }

    const updated = await db.updatePackage(String(id), updatePayload);

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Package not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Package updated successfully and synced with WhatsApp Bot!',
      product: toPublicPricingProduct(updated)
    });
  } catch (error) {
    console.error('Error updating pricing package:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch {
        // ignore if not json body
      }
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Package ID is required' }, { status: 400 });
    }

    const success = await db.deletePackage(id);
    if (!success) {
      return NextResponse.json({ success: false, error: 'Package not found or already deleted' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Package deleted successfully and removed from WhatsApp Bot'
    });
  } catch (error) {
    console.error('Error deleting package:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
