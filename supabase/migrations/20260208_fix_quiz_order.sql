-- Function to temporarily flip question orders to negative to avoid unique constraint violations during reordering
create or replace function public.prepare_quiz_reorder(p_quiz_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Flip all positive orders to negative to clear the positive integer space
  -- We use -ABS(order) - 1 to ensure they stay unique and negative
  -- Only update if order is >= 0 to avoid double-negative issues if called multiple times
  update public.quiz_questions
  set "order" = -abs("order") - 1000
  where quiz_id = p_quiz_id 
  and "order" >= 0;
end;
$$;
