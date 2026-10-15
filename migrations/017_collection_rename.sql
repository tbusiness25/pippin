-- Collection (the collectables module, renamed on the public branch): tables follow the new name.
-- Migration 015 created kid_pokedex and kid_pokedex_favourite; this renames them in place, keeping their rows.
ALTER TABLE IF EXISTS kid_pokedex RENAME TO kid_collection;
ALTER TABLE IF EXISTS kid_pokedex_favourite RENAME TO kid_collection_favourite;
ALTER INDEX IF EXISTS kid_pokedex_pkey RENAME TO kid_collection_pkey;
ALTER INDEX IF EXISTS kid_pokedex_favourite_pkey RENAME TO kid_collection_favourite_pkey;
