import { UserProfile } from '@/types';
import { getDbClient, isSupabaseConfigured } from '../client';
import { mockStore } from '../mock-store';

export const usersRepository = {
  async getOrCreateUser(phone: string, name?: string, address?: string): Promise<UserProfile> {
    const cleanPhone = phone.trim();
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
      if (u.phone_number === cleanPhone) {
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
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data } = await client
        .from('users')
        .select('*')
        .eq('phone_number', phone.trim())
        .single();
      if (data) return data;
    }
    for (const u of mockStore.users.values()) {
      if (u.phone_number === phone.trim()) return u;
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
  }
};
