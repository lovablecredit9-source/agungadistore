-- Update coin package: 1 ticket = 10.000 coins
UPDATE lucky_draw_ticket_packages
SET tickets = 1, cost_amount = 10000, name = '1 Tiket (Koin)'
WHERE id = 'e2b963a6-4029-451f-ae21-8727ef4fac64';

-- Add bigger gem packs (more than 10 tickets) + coin bulk options
INSERT INTO lucky_draw_ticket_packages (name, tickets, cost_currency, cost_amount, sort_order, is_active)
VALUES
  ('20 Tiket + Bonus', 25, 'gems', 60, 5, true),
  ('50 Tiket MEGA', 65, 'gems', 140, 6, true),
  ('100 Tiket ULTIMATE', 140, 'gems', 260, 7, true),
  ('5 Tiket (Koin)', 5, 'streak_coins', 45000, 8, true),
  ('10 Tiket (Koin)', 10, 'streak_coins', 85000, 9, true);