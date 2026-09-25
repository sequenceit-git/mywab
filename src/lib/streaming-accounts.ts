import { db } from './db';
import { PricingProduct } from './db/repositories/pricing';
import { Order, PackagePresetAccount } from '@/types';

export type StreamingServiceKey = 'netflix' | 'crunchyroll';

export interface StreamingAccountCredentials {
  email: string;
  password: string;
  pin?: string;
}

export function isNetflixOrder(order?: {
  items?: Array<{ product_name?: string }>;
  customer_notes?: string | null;
}): boolean {
  if (!order) return false;
  const itemNames = (order.items || []).map(i => i.product_name?.toLowerCase() || '').join(' ');
  const notes = (order.customer_notes || '').toLowerCase();
  return itemNames.includes('netflix') || notes.includes('netflix');
}

export function isCrunchyrollOrder(order?: {
  items?: Array<{ product_name?: string }>;
  customer_notes?: string | null;
}): boolean {
  if (!order) return false;
  const itemNames = (order.items || []).map(i => i.product_name?.toLowerCase() || '').join(' ');
  const notes = (order.customer_notes || '').toLowerCase();
  return itemNames.includes('crunchyroll') || notes.includes('crunchyroll');
}

export function getStreamingServiceForPackage(pkg: {
  id: string;
  name: string;
  categoryId?: string;
}): StreamingServiceKey | null {
  const blob = `${pkg.id} ${pkg.name} ${pkg.categoryId || ''}`.toLowerCase();
  if (blob.includes('netflix')) return 'netflix';
  if (blob.includes('crunchyroll')) return 'crunchyroll';
  return null;
}

export function presetAccountToCredentials(
  preset?: PackagePresetAccount
): StreamingAccountCredentials | null {
  if (!preset?.email?.trim() || !preset.password?.trim()) return null;
  return {
    email: preset.email.trim(),
    password: preset.password.trim(),
    pin: preset.pin?.trim() || undefined
  };
}

export function getPresetCredentialsFromProduct(
  product: PricingProduct | null | undefined
): StreamingAccountCredentials | null {
  if (!product) return null;
  const service = getStreamingServiceForPackage({
    id: product.id,
    name: product.name,
    categoryId: product.categoryId
  });
  if (!service) return null;
  return presetAccountToCredentials(product.presetAccount);
}

export async function resolveStreamingPresetForOrder(order: Order): Promise<{
  service: StreamingServiceKey;
  creds: StreamingAccountCredentials;
} | null> {
  const item = order.items?.[0];
  let product: PricingProduct | null = null;

  if (item?.product_id) {
    product = await db.getProductById(item.product_id);
  }

  if (!product && item?.product_name) {
    product = await db.findProduct(item.product_name);
  }

  if (!product) {
    if (isNetflixOrder(order)) {
      product = await db.getProductById('pkg_sub_netflix');
    } else if (isCrunchyrollOrder(order)) {
      product = await db.getProductById('pkg_sub_crunchyroll');
    }
  }

  if (!product) return null;

  const service = getStreamingServiceForPackage({
    id: product.id,
    name: product.name,
    categoryId: product.categoryId
  });
  if (!service) return null;

  const creds = getPresetCredentialsFromProduct(product);
  if (!creds) return null;

  return { service, creds };
}

export function buildStreamingCredsNote(
  service: StreamingServiceKey,
  creds: StreamingAccountCredentials
): string {
  if (service === 'netflix') {
    return `NETFLIX_CREDS_SENT | Email: ${creds.email} | Pass: ${creds.password}${creds.pin ? ` | PIN: ${creds.pin}` : ''}`;
  }
  return `CRUNCHYROLL_CREDS_SENT | Email: ${creds.email} | Pass: ${creds.password}`;
}

export function parsePresetAccountRequestBody(body: {
  presetAccount?: { email?: string; password?: string; pin?: string; clear?: boolean };
  presetEmail?: string;
  presetPassword?: string;
  presetPin?: string;
  clearPresetAccount?: boolean;
}): { email?: string; password?: string; pin?: string; clear?: boolean } | undefined {
  if (body.presetAccount) return body.presetAccount;
  if (
    body.clearPresetAccount ||
    body.presetEmail !== undefined ||
    body.presetPassword !== undefined ||
    body.presetPin !== undefined
  ) {
    return {
      email: body.presetEmail,
      password: body.presetPassword,
      pin: body.presetPin,
      clear: body.clearPresetAccount
    };
  }
  return undefined;
}

export function applyPresetAccountUpdate(
  existing: PackagePresetAccount | undefined,
  body: Parameters<typeof parsePresetAccountRequestBody>[0]
): PackagePresetAccount | null | undefined {
  const input = parsePresetAccountRequestBody(body);
  if (input === undefined) return undefined;
  return mergePackagePresetInput(existing, input);
}

export function mergePackagePresetInput(
  existing: PackagePresetAccount | undefined,
  input?: { email?: string; password?: string; pin?: string; clear?: boolean }
): PackagePresetAccount | null | undefined {
  if (input?.clear) return null;
  if (!input) return existing;

  const email =
    input.email !== undefined ? String(input.email).trim() : existing?.email?.trim() || '';
  const password =
    input.password !== undefined && String(input.password).trim()
      ? String(input.password).trim()
      : existing?.password?.trim() || '';

  // Explicit empty email+password from admin = clear account
  if (
    input.email !== undefined &&
    !String(input.email).trim() &&
    input.password !== undefined &&
    !String(input.password).trim()
  ) {
    return null;
  }

  if (!email && !password && input.pin === undefined) {
    return existing;
  }

  if (!email || !password) {
    return undefined;
  }

  const merged: PackagePresetAccount = { email, password };
  if (input.pin !== undefined) {
    const pin = String(input.pin).trim();
    if (pin) merged.pin = pin;
  } else if (existing?.pin) {
    merged.pin = existing.pin;
  }
  return merged;
}
