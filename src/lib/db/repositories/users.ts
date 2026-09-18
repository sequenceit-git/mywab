import { UserProfile } from '@/types';
import { getDbClient, isSupabaseConfigured } from '../client';
import { mockStore } from '../mock-store';

/**
 * Standardize phone number format (E.164 +880...) so unique users are strictly identified by phone
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length === 13) {
    return `+${digits}`;
  }
  if (digits.startsWith('01') && digits.length === 11) {
    return `+88${digits}`;
  }
  if (digits.startsWith('1') && digits.length === 10) {
    return `+880${digits}`;
  }
  return digits ? `+${digits}` : phone.trim();
}

export const usersRepository = {
  normalizePhoneNumber,

  async getOrCreateUser(phone: string, name?: string, address?: string): Promise<UserProfile> {
    const cleanPhone = normalizePhoneNumber(phone);
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data } = await client
        .from('users')
        .select('*')
        .eq('phone_number', cleanPhone)
        .single();
      
      if (data) {
        if (name && !data.name) {
          await client.from('users').update({ name, updated_at: new Date().toISOString() }).eq('id', data.id);
        }
        return data;
      }
      const newUser: UserProfile = {
        id: crypto.randomUUID(),
        phone_number: cleanPhone,
        name: name || null,
        address_profile: address ? { full_address: address } : {},
        language_pref: 'bn',
        status_tag: 'REGULAR',
        created_at: new Date().toISOString()
      };
      await client.from('users').insert(newUser);
      return newUser;
    }

    for (const u of mockStore.users.values()) {
      if (normalizePhoneNumber(u.phone_number) === cleanPhone) {
        if (name && !u.name) u.name = name;
        return u;
      }
    }

    const newUser: UserProfile = {
      id: `user-${Date.now()}`,
      phone_number: cleanPhone,
      name: name || null,
      address_profile: address ? { full_address: address } : {},
      language_pref: 'bn',
      status_tag: 'REGULAR',
      created_at: new Date().toISOString()
    };
    mockStore.users.set(newUser.id, newUser);
    return newUser;
  },

  async getUserByPhone(phone: string): Promise<UserProfile | null> {
    const cleanPhone = normalizePhoneNumber(phone);
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data } = await client
        .from('users')
        .select('*')
        .eq('phone_number', cleanPhone)
        .single();
      if (data) return data;
    }
    for (const u of mockStore.users.values()) {
      if (normalizePhoneNumber(u.phone_number) === cleanPhone) return u;
    }
    return null;
  },

  async getUserById(id: string): Promise<UserProfile | null> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data } = await client
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
      if (data) return data;
    }
    return mockStore.users.get(id) || null;
  },

  async updateUserAddress(userId: string, address: {
    street?: string;
    city?: string;
    area?: string;
    postal_code?: string;
    full_address?: string;
  }): Promise<UserProfile | null> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data } = await client
        .from('users')
        .update({ address_profile: address, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();
      if (data) return data;
    }
    const user = mockStore.users.get(userId);
    if (user) {
      user.address_profile = address;
      user.updated_at = new Date().toISOString();
      return user;
    }
    return null;
  },

  async updateUserStatus(userId: string, statusTag: 'VIP' | 'REGULAR' | 'FLAGGED'): Promise<UserProfile | null> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data } = await client
        .from('users')
        .update({ status_tag: statusTag, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();
      if (data) return data;
    }
    const user = mockStore.users.get(userId);
    if (user) {
      user.status_tag = statusTag;
      user.updated_at = new Date().toISOString();
      return user;
    }
    return null;
  },

  async getCustomerProfile(phone: string): Promise<import('@/types').CustomerMemoryProfile> {
    const cleanPhone = phone.trim();
    const user = await this.getUserByPhone(cleanPhone);
    const defaultProfile: import('@/types').CustomerMemoryProfile = {
      saved_uids: [],
      total_completed_orders: 0,
      preferred_payment: 'bKash'
    };

    if (!user || !user.customer_profile) {
      return defaultProfile;
    }

    return {
      ...defaultProfile,
      ...user.customer_profile
    };
  },

  async updateCustomerProfile(phone: string, updates: Partial<import('@/types').CustomerMemoryProfile>): Promise<void> {
    const cleanPhone = phone.trim();
    const user = await this.getOrCreateUser(cleanPhone);
    const currentProfile = user.customer_profile || {
      saved_uids: [],
      total_completed_orders: 0,
      preferred_payment: 'bKash'
    };

    const newSavedUids = Array.from(new Set([
      ...(updates.last_used_uid ? [updates.last_used_uid] : []),
      ...(updates.saved_uids || []),
      ...(currentProfile.saved_uids || [])
    ])).filter(Boolean);

    const mergedProfile: import('@/types').CustomerMemoryProfile = {
      ...currentProfile,
      ...updates,
      saved_uids: newSavedUids,
      last_used_uid: updates.last_used_uid || currentProfile.last_used_uid || (newSavedUids[0] ?? undefined)
    };

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      await client
        .from('users')
        .update({
          customer_profile: mergedProfile,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
    }

    user.customer_profile = mergedProfile;
    user.updated_at = new Date().toISOString();
  },

  async getUsers(): Promise<UserProfile[]> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        const { data, error } = await client
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.error('Supabase getUsers error:', err);
      }
    }
    return Array.from(mockStore.users.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async getUsersLeaderboard(): Promise<import('@/types').UserLeaderboardEntry[]> {
    const users = await this.getUsers();
    const { ordersRepository } = await import('./orders');
    const orders = await ordersRepository.getOrders();

    // Map orders by user_id and phone
    const ordersByUserId = new Map<string, typeof orders>();
    const ordersByPhone = new Map<string, typeof orders>();

    for (const order of orders) {
      if (order.user_id) {
        const list = ordersByUserId.get(order.user_id) || [];
        list.push(order);
        ordersByUserId.set(order.user_id, list);
      }
      if (order.delivery_phone) {
        const clean = order.delivery_phone.replace(/\D/g, '');
        const list = ordersByPhone.get(clean) || [];
        list.push(order);
        ordersByPhone.set(clean, list);
      }
    }

    const leaderboard: import('@/types').UserLeaderboardEntry[] = users.map(user => {
      const cleanUserPhone = (user.phone_number || '').replace(/\D/g, '');
      const userOrders = Array.from(
        new Set([
          ...(ordersByUserId.get(user.id) || []),
          ...(ordersByPhone.get(cleanUserPhone) || [])
        ])
      );

      const nonCancelledOrders = userOrders.filter(o => o.status !== 'CANCELLED');
      const deliveredOrders = userOrders.filter(o => o.status === 'DELIVERED');
      
      const totalSpent = nonCancelledOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      
      // Sort orders by date descending
      const sortedOrders = [...userOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const lastOrderAt = sortedOrders[0]?.created_at || null;
      const latestUid = sortedOrders.find(o => o.player_uid)?.player_uid || user.customer_profile?.last_used_uid || null;

      const allUids = Array.from(
        new Set([
          ...(user.customer_profile?.saved_uids || []),
          ...sortedOrders.map(o => o.player_uid).filter(Boolean)
        ])
      ) as string[];

      // Count favorite game/product
      const gameCounts = new Map<string, number>();
      for (const ord of userOrders) {
        for (const item of ord.items || []) {
          const name = item.product_name || 'Top-Up';
          gameCounts.set(name, (gameCounts.get(name) || 0) + 1);
        }
      }
      let favoriteGame: string | undefined = undefined;
      let maxCount = 0;
      for (const [game, count] of gameCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          favoriteGame = game;
        }
      }

      return {
        id: user.id,
        phone_number: user.phone_number,
        name: user.name,
        status_tag: user.status_tag || 'REGULAR',
        total_spent: totalSpent,
        total_orders: userOrders.length,
        delivered_orders: deliveredOrders.length,
        last_order_at: lastOrderAt,
        latest_uid: latestUid,
        saved_uids: allUids,
        favorite_game: favoriteGame,
        rank: 0, // Assigned below
        created_at: user.created_at
      };
    });

    // Sort by total_spent descending, then total_orders descending
    leaderboard.sort((a, b) => {
      if (b.total_spent !== a.total_spent) {
        return b.total_spent - a.total_spent;
      }
      return b.total_orders - a.total_orders;
    });

    // Assign rank 1-indexed
    leaderboard.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    return leaderboard;
  }
};
