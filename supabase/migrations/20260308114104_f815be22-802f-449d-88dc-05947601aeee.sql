-- Insert all admin feature permissions (skip if already exists)
INSERT INTO public.permissions (name, feature, action, description)
VALUES
  -- Dashboard
  ('read_dashboard', 'dashboard', 'read', 'View admin dashboard'),
  
  -- Users
  ('read_users', 'users', 'read', 'View users'),
  ('create_users', 'users', 'create', 'Create users'),
  ('update_users', 'users', 'update', 'Update users'),
  ('delete_users', 'users', 'delete', 'Delete users'),
  
  -- Reports
  ('read_reports', 'reports', 'read', 'View reports'),
  ('export_reports', 'reports', 'export', 'Export reports'),
  
  -- Stock
  ('read_stock', 'stock', 'read', 'View stock'),
  ('create_stock', 'stock', 'create', 'Add stock'),
  ('update_stock', 'stock', 'update', 'Update stock'),
  ('delete_stock', 'stock', 'delete', 'Delete stock'),
  ('transfer_stock', 'stock', 'transfer', 'Transfer stock between godowns'),
  
  -- Purchase
  ('read_purchase', 'purchase', 'read', 'View purchase records'),
  ('create_purchase', 'purchase', 'create', 'Create purchase records'),
  ('update_purchase', 'purchase', 'update', 'Update purchase records'),
  ('delete_purchase', 'purchase', 'delete', 'Delete purchase records'),
  
  -- Flash Sales / Offers
  ('read_offers', 'offers', 'read', 'View flash sales and offers'),
  ('create_offers', 'offers', 'create', 'Create flash sales'),
  ('update_offers', 'offers', 'update', 'Update flash sales'),
  ('delete_offers', 'offers', 'delete', 'Delete flash sales'),
  
  -- Penny Prime
  ('read_penny_prime', 'penny_prime', 'read', 'View Penny Prime'),
  ('manage_penny_prime', 'penny_prime', 'manage', 'Manage Penny Prime'),
  
  -- Wallets
  ('read_wallets', 'wallets', 'read', 'View wallets'),
  ('credit_wallets', 'wallets', 'credit', 'Credit to wallets'),
  ('debit_wallets', 'wallets', 'debit', 'Debit from wallets'),
  ('manage_wallet_rules', 'wallets', 'manage', 'Manage wallet rules'),
  
  -- App Settings
  ('read_settings', 'settings', 'read', 'View app settings'),
  ('update_settings', 'settings', 'update', 'Update app settings'),
  
  -- Storage Config
  ('read_storage', 'storage', 'read', 'View storage config'),
  ('update_storage', 'storage', 'update', 'Update storage config'),
  
  -- Delivery Management
  ('read_delivery', 'delivery', 'read', 'View delivery management'),
  ('assign_delivery', 'delivery', 'assign', 'Assign delivery staff'),
  ('manage_delivery', 'delivery', 'manage', 'Manage delivery operations')
  
ON CONFLICT (name) DO NOTHING;