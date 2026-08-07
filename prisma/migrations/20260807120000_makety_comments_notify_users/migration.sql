-- Adresné notifikace u komentářů maket/grafiky
ALTER TABLE `makety_comments`
  ADD COLUMN `notify_user_ids` JSON NULL AFTER `body`;
