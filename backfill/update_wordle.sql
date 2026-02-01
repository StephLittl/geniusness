-- Convert Wordle scores from "remaining slots" (0-5, -1 fail) to "guesses" (1-6, 7 fail)
UPDATE public.scores
SET score = CASE
  WHEN score = -1 THEN 7
  WHEN score >= 0 AND score <= 5 THEN 6 - score
  ELSE score
END
WHERE game_id = 'e505888f-ecb8-4764-9c9c-e1d9734b6c95';
