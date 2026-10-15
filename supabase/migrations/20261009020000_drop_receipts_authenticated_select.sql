-- The `receipts` bucket is private and only the server (service role) reads or
-- writes it (payments repository, /api/payments/receipt-url, /api/ai/tahlil).
-- This leftover SELECT policy let ANY signed-in user list and download every
-- student's payment receipt straight through the Storage API.
drop policy if exists "Anyone can view receipts" on storage.objects;
