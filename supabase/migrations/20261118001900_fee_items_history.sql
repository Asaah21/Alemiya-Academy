-- T17: fee items can be deleted by the Admin (a wrong item), but the removed row is kept in history (rule F1).
create trigger fee_items_history_delete after delete on public.fee_items
  for each row execute function public.log_history();
