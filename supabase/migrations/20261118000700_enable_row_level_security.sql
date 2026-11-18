-- T02 / migration 7: lock every table.
-- Row-level security is switched on with NO policies, so the browser (anon and logged-in users)
-- can read and write nothing until T03 adds the role policies. Nothing is exposed by accident.

alter table public.settings enable row level security;
alter table public.academic_years enable row level security;
alter table public.terms enable row level security;
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;
alter table public.grade_scale enable row level security;
alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.students enable row level security;
alter table public.student_movements enable row level security;
alter table public.parent_access enable row level security;
alter table public.attendance_weeks enable row level security;
alter table public.attendance_entries enable row level security;
alter table public.staff_attendance enable row level security;
alter table public.non_school_days enable row level security;
alter table public.scores enable row level security;
alter table public.report_remarks enable row level security;
alter table public.results_publish enable row level security;
alter table public.fee_items enable row level security;
alter table public.payments enable row level security;
alter table public.term_snapshots enable row level security;
alter table public.history enable row level security;
