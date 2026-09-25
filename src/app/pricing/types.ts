import { PackagePresetAccountPublic } from '@/types';

export interface PricingProduct {
  id: string;
  categoryId: string;
  categoryTitle: string;
  categoryEmoji?: string;
  name: string;
  amount: string;
  price: number;
  basePrice: number;
  profit: number;
  marginPercent: number;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
  updatedAt?: string;
  presetAccount?: PackagePresetAccountPublic;
  /** Per-package Kokos auto-fulfillment override: true = force ON, false = force OFF, undefined = inherit global toggle */
  kokosAutoFulfill?: boolean;
}

export interface CategoryInfo {
  id: string;
  code: string;
  title: string;
  fullName: string;
  emoji: string;
  requiresUid: boolean;
  inputPrompt: string;
  inputLabel: string;
  packages: any[];
}

export interface PricingStats {
  totalProducts: number;
  totalPotentialRevenue: number;
  totalBaseCost: number;
  totalProfit: number;
  avgMarginPercent: number;
  avgProfitPerUnit: number;
}
