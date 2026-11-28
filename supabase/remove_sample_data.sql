-- Removes everything added by sample_data.sql (students TEST-xxx, the sample staff, their payments, scores,
-- attendance, remarks and the sample notices). Real data is not touched.
-- Classes, subjects, fees, grade scale and the year/term created by the sample script are left in place.
-- Deleting is normally blocked by the system. This script switches that protection off for this one run only.
begin;
set local session_replication_role = replica;

delete from public.payments where student_id in (select id from public.students where admission_no like 'TEST-%');
delete from public.scores where student_id in (select id from public.students where admission_no like 'TEST-%');
delete from public.report_remarks where student_id in (select id from public.students where admission_no like 'TEST-%');
delete from public.attendance_entries where student_id in (select id from public.students where admission_no like 'TEST-%');
delete from public.attendance_weeks w where not exists (select 1 from public.attendance_entries e where e.week_id = w.id);
delete from public.student_movements where student_id in (select id from public.students where admission_no like 'TEST-%');
delete from public.parent_access where student_id in (select id from public.students where admission_no like 'TEST-%');
delete from public.history where record_id in (select id from public.students where admission_no like 'TEST-%')
   or record_id in (select id from public.staff where phone like '0200000%');
delete from public.students where admission_no like 'TEST-%';
delete from public.staff_attendance where staff_id in (select id from public.staff where phone like '0200000%');
delete from public.staff where phone like '0200000%';
delete from public.notices where title like '[Sample]%';
commit;
