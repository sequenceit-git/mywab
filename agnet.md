
 Core Features

 (Tentative — may be changed based on architectural limitations)

 AI-powered WhatsApp customer support\
 Automatic customer conversation & replies\
 Product/service information\
 Price, availability & offer information\
 Bangla + English language support\
 FAQ / predefined answers\
 WhatsApp-based order creation\
 Automatic Order ID generation\
 Payment integration & verification\
 Order status management\
 Automatic order/payment notifications\
 Customer name, details & profiles\
 Customer order history & previous conversation history\
 Customer tagging/status\
 Admin dashboard (on website)\
 Customer, order & sales analytics\
 Manual + AI customer support\
 Admin roles & access control\
 Database for customers, orders, payments & conversations\
 Worker Management — Telegram Group + Bot

 Worker-related order management will be handled through a Telegram group using a dedicated Telegram bot.

 Automatically forward new order information to the designated Telegram worker group\
 Send customer details to the worker group\
 Send order details, including:\
 Order ID\
 Product/service\
 Quantity/details\
 Customer information\
 Delivery information\
 Payment status\
 Workers can accept/claim an order directly through the Telegram bot\
 Once an order is claimed, the system will record which worker accepted it\
 Prevent multiple workers from claiming the same order\
 Workers can update order status through Telegram bot actions\
 Track which worker is currently handling each order\
 Notify the admin/dashboard when a worker accepts or updates an order\
 Automatically synchronize worker status updates with the main order management system\
 When an order is completed, automatically send a completion notification to the customer via WhatsApp\
 Maintain a history of worker assignments, claims and status changes\
 Admin can monitor worker activity and order assignments from the website dashboard\
 Worker access and available actions can be controlled through Telegram bot permissions/roles

 This architecture makes the flow essentially:

 Customer → WhatsApp → AI/Order System → Telegram Group + Bot → Worker → Order System → WhatsApp Customer Notification

 The important architectural point is that Telegram is only the worker interface; the central database/order system remains the source of truth, so worker actions in Telegram are synchronized with the admin dashboard and customer WhatsApp conversation.