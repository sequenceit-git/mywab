import { Worker, OrderAssignment, Order } from '@/types';
import { getDbClient, isSupabaseConfigured } from '../client';
import { mockStore } from '../mock-store';
import { ordersRepository } from './orders';

export const workersRepository = {
  async getWorkers(): Promise<Worker[]> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        const { data: workers, error } = await client
          .from('workers')
          .select(`
            *,
            assignments:order_assignments(
              id,
              status,
              order:orders(id, status)
            )
          `)
          .order('created_at', { ascending: false });

        if (!error && workers) {
          return workers.map((w: any) => {
            const assignments = Array.isArray(w.assignments) ? w.assignments : [];
            const activeCount = assignments.filter((a: any) => {
              const currentStatus = a.order?.status || a.status;
              return ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(currentStatus);
            }).length;

            const completedCount = assignments.filter((a: any) => {
              const currentStatus = a.order?.status || a.status;
              return currentStatus === 'DELIVERED';
            }).length;

            return {
              id: w.id,
              telegram_user_id: w.telegram_user_id,
              telegram_username: w.telegram_username,
              full_name: w.full_name,
              phone_number: w.phone_number,
              role: w.role,
              is_active: w.is_active,
              created_at: w.created_at,
              active_orders: activeCount,
              total_completed_orders: completedCount
            };
          });
        }
        if (error) console.error('Supabase getWorkers join error, falling back:', error);

        // Fallback aggregation
        const { data: baseWorkers } = await client.from('workers').select('*').order('created_at', { ascending: false });
        const { data: allAssignments } = await client.from('order_assignments').select('*');
        if (baseWorkers) {
          return baseWorkers.map((w: any) => {
            const wAssignments = (allAssignments || []).filter((a: any) => a.worker_id === w.id);
            const activeCount = wAssignments.filter((a: any) => ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(a.status)).length;
            const completedCount = wAssignments.filter((a: any) => a.status === 'DELIVERED').length;
            return {
              ...w,
              active_orders: activeCount,
              total_completed_orders: completedCount
            };
          });
        }
      } catch (err) {
        console.error('Supabase getWorkers error:', err);
      }
      return [];
    }

    const orders = Array.from(mockStore.orders.values());
    const workers = Array.from(mockStore.workers.values());
    return workers.map(w => {
      const workerOrders = orders.filter(o => 
        o.current_worker?.id === w.id || 
        o.current_worker?.telegram_user_id === w.telegram_user_id ||
        o.assignments?.some(a => a.worker_id === w.id || a.worker?.telegram_user_id === w.telegram_user_id)
      );
      const activeCount = workerOrders.filter(o => ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status)).length;
      const completedCount = workerOrders.filter(o => o.status === 'DELIVERED').length;
      return {
        ...w,
        active_orders: activeCount,
        total_completed_orders: completedCount
      };
    });
  },

  async getWorkerByTelegramId(telegramUserId: number): Promise<Worker | null> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data } = await client
        .from('workers')
        .select('*')
        .eq('telegram_user_id', telegramUserId)
        .single();
      if (data) return data;
    }
    for (const w of mockStore.workers.values()) {
      if (w.telegram_user_id === telegramUserId) return w;
    }
    return null;
  },

  async claimOrderAtomic(params: {
    orderIdCode: string;
    telegramUserId: number;
    workerName: string;
    telegramUsername?: string;
  }): Promise<{ success: boolean; message: string; order?: Order; worker?: Worker }> {
    const { orderIdCode, telegramUserId, workerName, telegramUsername } = params;
    const client = getDbClient();

    if (isSupabaseConfigured() && client) {
      try {
        // 1. Ensure worker exists in Supabase
        let { data: worker } = await client
          .from('workers')
          .select('*')
          .eq('telegram_user_id', telegramUserId)
          .single();

        if (!worker) {
          const { data: newWorker, error: createErr } = await client
            .from('workers')
            .insert({
              telegram_user_id: telegramUserId,
              telegram_username: telegramUsername || null,
              full_name: workerName,
              role: 'WORKER',
              is_active: true
            })
            .select()
            .single();

          if (createErr) console.error('Failed to create worker in claimOrderAtomic:', createErr);
          worker = newWorker;
        }

        // 2. Atomic claim update
        const { data: updatedOrder, error: claimErr } = await client
          .from('orders')
          .update({
            status: 'CLAIMED',
            updated_at: new Date().toISOString()
          })
          .eq('order_id', orderIdCode)
          .eq('status', 'PENDING_CLAIM')
          .select(`
            *,
            customer:users(*),
            items:order_items(*)
          `)
          .single();

        if (claimErr || !updatedOrder) {
          const currentOrder = await ordersRepository.getOrderByCode(orderIdCode);
          if (!currentOrder) {
            return { success: false, message: 'অর্ডারটি সিস্টেমে পাওয়া যায়নি।' };
          }
          if (currentOrder.status !== 'PENDING_CLAIM') {
            const assignedWorkerName = currentOrder.current_worker?.full_name || 'অন্য একজন কর্মী';
            return {
              success: false,
              message: `অর্ডারটি ইতিমধ্যে ${assignedWorkerName} ক্লেইম করে নিয়েছেন!`
            };
          }
          return { success: false, message: 'অর্ডার ক্লেইম করতে ব্যর্থ হয়েছে।' };
        }

        // 3. Create or update assignment record
        if (worker) {
          await client
            .from('order_assignments')
            .insert({
              order_id: updatedOrder.id,
              worker_id: worker.id,
              status: 'CLAIMED',
              claimed_at: new Date().toISOString()
            });
        }

        const populatedOrder = ordersRepository.hydrateOrder({
          ...updatedOrder,
          current_worker: worker || undefined
        });

        return {
          success: true,
          message: 'সফলভাবে অর্ডারটি ক্লেইম করেছেন!',
          order: populatedOrder,
          worker: worker || undefined
        };
      } catch (err) {
        console.error('Supabase atomic claim exception:', err);
      }
    }

    // In-memory fallback
    const order = await ordersRepository.getOrderByCode(orderIdCode);
    if (!order) {
      return { success: false, message: 'অর্ডারটি সিস্টেমে পাওয়া যায়নি।' };
    }

    if (order.status !== 'PENDING_CLAIM') {
      const assignedName = order.current_worker?.full_name || 'অন্য একজন কর্মী';
      return {
        success: false,
        message: `অর্ডারটি ইতিমধ্যে ${assignedName} ক্লেইম করে নিয়েছেন!`
      };
    }

    let worker = await this.getWorkerByTelegramId(telegramUserId);
    if (!worker) {
      worker = {
        id: `worker-${telegramUserId}`,
        telegram_user_id: telegramUserId,
        telegram_username: telegramUsername || null,
        full_name: workerName,
        role: 'WORKER',
        is_active: true,
        created_at: new Date().toISOString()
      };
      mockStore.workers.set(worker.id, worker);
    }

    order.status = 'CLAIMED';
    order.current_worker = worker;
    order.updated_at = new Date().toISOString();

    for (const o of mockStore.orders.values()) {
      if (o.order_id.toUpperCase() === orderIdCode.toUpperCase() || o.id === order.id) {
        o.status = 'CLAIMED';
        o.current_worker = worker;
        o.updated_at = new Date().toISOString();
        break;
      }
    }

    return {
      success: true,
      message: 'সফলভাবে অর্ডারটি ক্লেইম করেছেন!',
      order,
      worker
    };
  },

  async assignWorker(orderId: string, workerId: string): Promise<OrderAssignment> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data } = await client
        .from('order_assignments')
        .insert({
          order_id: orderId,
          worker_id: workerId,
          status: 'CLAIMED',
          claimed_at: new Date().toISOString()
        })
        .select()
        .single();

      await client
        .from('orders')
        .update({ status: 'CLAIMED', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (data) return data;
    }

    const assignment: OrderAssignment = {
      id: `assign-${Date.now()}`,
      order_id: orderId,
      worker_id: workerId,
      status: 'CLAIMED',
      claimed_at: new Date().toISOString()
    };
    mockStore.assignments.set(assignment.id, assignment);
    return assignment;
  },

  async updateAssignmentStatus(assignmentId: string, status: OrderAssignment['status']): Promise<boolean> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const payload: any = { status };
      if (status === 'DELIVERED') payload.completed_at = new Date().toISOString();
      const { error } = await client
        .from('order_assignments')
        .update(payload)
        .eq('id', assignmentId);
      return !error;
    }
    const a = mockStore.assignments.get(assignmentId);
    if (a) {
      a.status = status;
      if (status === 'DELIVERED') a.completed_at = new Date().toISOString();
      return true;
    }
    return false;
  }
};
