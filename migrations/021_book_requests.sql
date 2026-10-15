-- A child can ask for a book they don't have ("can we get it?"); parents see it at the top of the shopping list.
ALTER TABLE kid_book_status ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ;
