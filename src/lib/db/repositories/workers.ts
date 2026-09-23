import { Worker, OrderAssignment, Order } from '@/types';
import { connectToDatabase, isDbConfigured } from '../client';
import { WorkerModel } from '../models/Worker';
import { OrderModel } from '../models/Order';
import { mockStore } from '../mock-store';
import { ordersRepository } from './orders';

export const workersRepository = {
  async getWorkers(): Promise<Worker[]> {
    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        const workers = await WorkerModel.find().sort({ created_at: -1 }).lean();

        // Aggregate worker order counts
        const orderCounts = await OrderModel.aggregate([
          { $match: { 'current_worker.telegram_user_id': { $ne: null } } },
          {
            $group: {
              _id: '$current_worker.telegram_user_id',
              activeOrders: {
                $sum: {
                  $cond: [{ $in: ['$status', ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY']] }, 1, 0]
                }
              },
              completedOrders: {
                $sum: {
                  $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0]
                }
              }
            }
          }
        ]);

        const countsMap = new Map<number, { active: number; completed: number }>();
        for (const item of orderCounts) {
          countsMap.set(Number(item._id), { active: item.activeOrders || 0, completed: item.completedOrders || 0 });
        }

        return workers.map((w: any) => {
          const stats = countsMap.get(Number(w.telegram_user_id)) || { active: 0, completed: 0 };
          return {
            id: w.id,
            telegram_user_id: w.telegram_user_id,
            telegram_username: w.telegram_username,
            full_name: w.full_name,
            phone_number: w.phone_number,
            role: w.role,
            is_active: w.is_active,
            created_at: w.created_at,
            active_orders: stats.active,
            total_completed_orders: stats.completed
          };
        });
      } catch (err) {
        console.error('[MongoDB getWorkers error]:', err);
      }
    }

    const orders = Array.from(mockStore.orders.values());
    const workers = Array.from(mockStore.workers.values());
    return workers.map(w => {
      const workerOrders = orders.filter(o => 
        o.current_worker?.id === w.id || 
        o.current_worker?.telegram_user_id === w.telegram_user_id
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
    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        const doc = await WorkerModel.findOne({ telegram_user_id: telegramUserId }).lean();
        if (doc) return doc as any;
      } catch (err) {
        console.error('[MongoDB getWorkerByTelegramId error]:', err);
      }
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

    if (isDbConfigured()) {
      try {
        await connectToDatabase();

        // 1. Ensure worker exists in MongoDB
        let workerDoc = await WorkerModel.findOne({ telegram_user_id: telegramUserId });
        if (!workerDoc) {
          workerDoc = await WorkerModel.create({
            id: crypto.randomUUID(),
            telegram_user_id: telegramUserId,
            telegram_username: telegramUsername || null,
            full_name: workerName,
            role: 'WORKER',
            is_active: true,
            created_at: new Date().toISOString()
          });
        }

        const workerPayload = {
          id: workerDoc.id,
          telegram_user_id: workerDoc.telegram_user_id,
          telegram_username: workerDoc.telegram_username,
          full_name: workerDoc.full_name,
          phone_number: workerDoc.phone_number,
          role: workerDoc.role
        };

        // 2. Atomic claim update via findOneAndUpdate
        const updatedOrderDoc = await OrderModel.findOneAndUpdate(
          {
            $or: [
              { order_id: { $regex: new RegExp(`^${orderIdCode.trim()}$`, 'i') } },
              { id: orderIdCode.trim() }
            ],
            status: 'PENDING_CLAIM'
          },
          {
            $set: {
              status: 'CLAIMED',
              current_worker: workerPayload,
              updated_at: new Date().toISOString()
            }
          },
          { new: true }
        ).lean();

        if (!updatedOrderDoc) {
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

        const populatedOrder = ordersRepository.hydrateOrder(updatedOrderDoc);

        return {
          success: true,
          message: 'সফলভাবে অর্ডারটি ক্লেইম করেছেন!',
          order: populatedOrder,
          worker: workerDoc.toObject() as any
        };
      } catch (err) {
        console.error('[MongoDB atomic claim exception]:', err);
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
    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        const worker = await WorkerModel.findOne({ $or: [{ id: workerId }, { telegram_user_id: Number(workerId) || 0 }] }).lean();
        if (worker) {
          const workerPayload = {
            id: worker.id,
            telegram_user_id: worker.telegram_user_id,
            telegram_username: worker.telegram_username,
            full_name: worker.full_name,
            phone_number: worker.phone_number,
            role: worker.role
          };
          await OrderModel.updateOne(
            { $or: [{ id: orderId }, { order_id: orderId }] },
            {
              $set: {
                status: 'CLAIMED',
                current_worker: workerPayload,
                updated_at: new Date().toISOString()
              }
            }
          );
        }
      } catch (err) {
        console.error('[MongoDB assignWorker error]:', err);
      }
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
    const a = mockStore.assignments.get(assignmentId);
    if (a) {
      a.status = status;
      if (status === 'DELIVERED') a.completed_at = new Date().toISOString();
      return true;
    }
    return false;
  }
};
