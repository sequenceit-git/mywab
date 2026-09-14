-- Sample Seed Data for WapBusiness

-- 1. Sample Products (Bengali & English)
INSERT INTO public.products (sku, name_en, name_bn, description_en, description_bn, price, stock_qty, category, is_active)
VALUES
('TSHIRT-BLK-M', 'Premium Cotton T-Shirt (Black, M)', 'প্রিমিয়াম কটন টি-শার্ট (কালো, M)', '100% combed organic cotton, breathable fabric.', '১০০% কম্বড অর্গানিক কটন, আরামদায়ক কাপড়।', 450.00, 50, 'Clothing', true),
('TSHIRT-WHT-L', 'Classic Polo Shirt (White, L)', 'ক্লাসিক পোলো শার্ট (সাদা, L)', 'High quality pique cotton polo shirt.', 'উন্নত মানের পিকে কটন পোলো শার্ট।', 650.00, 35, 'Clothing', true),
('JEANS-BLU-32', 'Slim Fit Denim Jeans (Size 32)', 'স্লিম ফিট ডেনিম জিন্স (সাইজ ৩২)', 'Stretchable denim fabric with stylish wash.', 'স্ট্রেচেবল ডেনিম কাপড় ও প্রিমিয়াম ওয়াশ।', 1250.00, 20, 'Clothing', true),
('SHOE-SNK-42', 'Casual Urban Sneakers (Size 42)', 'ক্যাজুয়াল আরবান স্নিকার্স (সাইজ ৪২)', 'Lightweight and durable daily wear sneakers.', 'হালকা এবং টেকসই দৈনন্দিন ব্যবহারের জুতো।', 1850.00, 15, 'Footwear', true),
('WTCH-SMT-01', 'Smart Fitness Watch V2', 'স্মার্ট ফিটনেস ওয়াচ V2', 'Heart rate monitor, step tracker, 7 days battery.', 'হার্ট রেট মনিটর, স্টেপ ট্র্যাকার, ৭ দিনের ব্যাটারি লাইফ।', 2200.00, 25, 'Electronics', true)
ON CONFLICT (sku) DO NOTHING;

-- 2. Sample FAQs (Bengali & English)
INSERT INTO public.faqs (question_en, question_bn, answer_en, answer_bn, category)
VALUES
(
    'What are your delivery charges and timeframe?',
    'ডেলিভারি চার্জ এবং সময় কত লাগবে?',
    'Inside Dhaka: ৳60 (24-48 hours). Outside Dhaka: ৳120 (2-4 days).',
    'ঢাকার ভেতরে: ৬০ টাকা (২৪-৪৮ ঘন্টা)। ঢাকার বাইরে: ১২০ টাকা (২-৪ দিন)।',
    'Delivery'
),
(
    'What payment methods do you accept?',
    'পেমেন্ট করার কি কি মাধ্যম আছে?',
    'We accept Cash on Delivery (COD), bKash, Nagad, and Rocket.',
    'আমরা ক্যাশ অন ডেলিভারি (COD), বিকাশ, নগদ এবং রকেট গ্রহণ করি।',
    'Payment'
),
(
    'What is your return/exchange policy?',
    'রিটার্ন বা এক্সচেঞ্জ পলিসি কি?',
    'You can exchange or return any defective product within 7 days of receipt with original invoice.',
    'পণ্য পাওয়ার ৭ দিনের মধ্যে যেকোনো ত্রুটিযুক্ত পণ্য ক্যাশ মেমোসহ পরিবর্তন করতে পারবেন।',
    'Return'
);
