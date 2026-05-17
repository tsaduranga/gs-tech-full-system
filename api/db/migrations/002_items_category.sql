-- Optional grouping for catalogue / POS items
ALTER TABLE items
  ADD COLUMN category VARCHAR(100) NULL DEFAULT NULL AFTER name;
