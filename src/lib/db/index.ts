import { faqsRepository } from './repositories/faqs';
import { usersRepository } from './repositories/users';
import { ordersRepository } from './repositories/orders';
import { workersRepository } from './repositories/workers';
import { chatRepository } from './repositories/chat';
import { analyticsRepository } from './repositories/analytics';

export { mockStore } from './mock-store';
export {
  DEFAULT_DS_DUKAN_FAQS
} from './seeds';

// Central Database Service Facade
export const db = {
  // FAQs
  ...faqsRepository,

  // Users / Customers
  ...usersRepository,

  // Orders
  ...ordersRepository,

  // Workers
  ...workersRepository,

  // Chat & Multi-Customer Session State
  ...chatRepository,

  // Analytics & Payments
  ...analyticsRepository
};

