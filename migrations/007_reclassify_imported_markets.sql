-- Reclassify HKJC rows imported before market labels were preserved.
-- The source statement's bet type was not stored on bet_legs, so use the
-- distinctive selection shapes emitted by the importer.
update bet_legs
   set market = 'correct_score'
 where market = 'other'
   and selection ~ '^[0-9]+:[0-9]+$';

update bet_legs
   set market = 'corner_totals'
 where market = 'other'
   and selection ~ '^大 \[[0-9.]+ 個\]$';

update bet_legs
   set market = 'same_game'
 where market = 'other'
   and selection ~ '^[0-9]+\. .*&.*';
