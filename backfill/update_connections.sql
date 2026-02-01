-- Convert Connections: spreadsheet 5=0 mistakes, 4=1, 3=2, 2=3, 1=4, 0=fail → DB stores mistakes (0-4), fail=4
UPDATE public.scores
SET score = CASE
  WHEN score = 0 THEN 4
  WHEN score >= 1 AND score <= 5 THEN 5 - score
  ELSE score
END
WHERE game_id = '79a41d7a-c91f-4b17-8225-fd8e53ac36e1';
