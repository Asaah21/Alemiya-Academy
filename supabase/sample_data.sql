-- SAMPLE DATA for testing Alemiya Academy. Run this ONCE in the Supabase SQL Editor.
-- It adds made-up students, staff, attendance, scores, fees, payments and notices so you can try every screen.
-- Everything it adds can be removed again with supabase/remove_sample_data.sql.
-- Do NOT run it after real students have been entered if you do not want made-up people next to real ones.
-- It does not create login accounts. Use Setup > Users for those.
do $$
declare
  v_term public.terms;
  v_year public.academic_years;
  c record; s record; st record; sf record;
  v_n integer := 0;
  v_class_n integer;
  v_names_f text[] := array['Abena','Akosua','Ama','Adwoa','Efua','Esi','Yaa','Afia','Akua','Maame','Serwaa','Nana','Gifty','Grace','Mercy','Comfort'];
  v_names_m text[] := array['Kwame','Kofi','Kwesi','Yaw','Kwabena','Kojo','Fiifi','Nii','Kwaku','Yaw','Samuel','Daniel','Joseph','Isaac','Emmanuel','Michael'];
  v_sur text[] := array['Mensah','Boateng','Asante','Owusu','Addo','Appiah','Ofori','Amoah','Quaye','Tetteh','Darko','Agyeman','Badu','Osei','Antwi','Gyamfi','Acheampong','Sarpong'];
  v_gender text; v_first text; v_last text; v_mid text;
  v_week date; v_wk uuid; v_pay numeric; v_fee numeric; v_i integer;
  v_subjects text[] := array['English Language','Mathematics','Integrated Science','Social Studies','Religious and Moral Education','Creative Arts'];
  v_sub text; v_mark numeric; v_staff_ids uuid[];
begin
  if exists (select 1 from public.students where admission_no like 'TEST-%') then
    raise notice 'Sample data is already in the system. Nothing was added.';
    return;
  end if;

  -- Classes: only if none exist
  if not exists (select 1 from public.classes) then
    insert into public.classes (name, level_order, scored) values
      ('Creche',1,false),('Nursery 1',2,false),('Nursery 2',3,false),('KG 1',4,false),('KG 2',5,false),
      ('Basic 1',6,true),('Basic 2',7,true),('Basic 3',8,true),('Basic 4',9,true),('Basic 5',10,true),('Basic 6',11,true),
      ('JHS 1',12,true),('JHS 2',13,true),('JHS 3',14,true);
  end if;

  -- Subjects and which class takes them (only for scored classes that have none yet)
  foreach v_sub in array v_subjects loop
    insert into public.subjects (name, type) values (v_sub, 'core') on conflict do nothing;
  end loop;
  for c in select id from public.classes where scored loop
    if not exists (select 1 from public.class_subjects where class_id = c.id) then
      insert into public.class_subjects (class_id, subject_id)
        select c.id, id from public.subjects where name = any (v_subjects) on conflict do nothing;
    end if;
  end loop;

  -- Grade scale: only if empty
  if not exists (select 1 from public.grade_scale) then
    insert into public.grade_scale (min_score, max_score, grade, remark) values
      (80,100,'A','Excellent'),(70,79.99,'B','Very good'),(60,69.99,'C','Good'),
      (50,59.99,'D','Satisfactory'),(40,49.99,'E','Pass'),(0,39.99,'F','Needs help');
  end if;

  -- Year and term: use the current ones, or create them
  select * into v_term from public.terms where is_current limit 1;
  if v_term.id is null then
    select * into v_year from public.academic_years where is_current limit 1;
    if v_year.id is null then
      insert into public.academic_years (name, start_date, end_date, is_current)
        values ('2026/2027', date '2026-09-01', date '2027-07-31', true) returning * into v_year;
    end if;
    insert into public.terms (academic_year_id, name, start_date, end_date, is_current)
      values (v_year.id, 'Term 1', date '2026-09-08', date '2026-12-18', true) returning * into v_term;
  end if;

  -- Staff
  insert into public.staff (full_name, phone, subject_notes, class_id, status)
  select n, '020000000' || i, sb, (select id from public.classes order by level_order offset (i + 5) % 14 limit 1), 'active'
  from (values
    (1,'Mr. Kwabena Frimpong','English'),(2,'Mrs. Ama Serwaa Adjei','Mathematics'),(3,'Mr. Yaw Ofosu','Science'),
    (4,'Miss Gifty Owusu','Social Studies'),(5,'Mr. Isaac Nkrumah','RME'),(6,'Mrs. Efua Mensah','Creative Arts')
  ) as t(i, n, sb);
  select array_agg(id) into v_staff_ids from public.staff where phone like '0200000%';

  -- Students: 6 in each of the first 14 classes
  for c in select id, level_order, scored from public.classes order by level_order limit 14 loop
    for v_i in 1..6 loop
      v_n := v_n + 1;
      v_gender := case when v_i % 2 = 0 then 'female' else 'male' end;
      v_first := case when v_gender = 'female' then v_names_f[1 + (v_n * 7) % 16] else v_names_m[1 + (v_n * 5) % 16] end;
      v_mid := v_sur[1 + (v_n * 3) % 18];
      v_last := v_sur[1 + (v_n * 11 + 4) % 18];
      insert into public.students (admission_no, full_name, gender, date_of_birth, class_id, guardian_name, guardian_phone, admitted_on)
      values ('TEST-' || lpad(v_n::text, 3, '0'),
              v_first || ' ' || v_mid || ' ' || v_last, v_gender,
              date '2026-01-01' - ((c.level_order + 3) * 365 + (v_n * 17) % 300),
              c.id,
              'Mr. ' || v_last || ' (guardian)', '024' || lpad(((v_n * 7919) % 10000000)::text, 7, '0'),
              date '2026-09-08');
    end loop;
  end loop;

  -- Fees for each class this term, then payments (some paid in full, some part, some nothing)
  for c in select id, level_order from public.classes order by level_order limit 14 loop
    if not exists (select 1 from public.fee_items where class_id = c.id and term_id = v_term.id) then
      insert into public.fee_items (class_id, term_id, name, amount) values
        (c.id, v_term.id, 'School fees', 150 + c.level_order * 15),
        (c.id, v_term.id, 'PTA dues', 20);
    end if;
  end loop;
  v_i := 0;
  for st in select s2.id, s2.class_id from public.students s2 where s2.admission_no like 'TEST-%' order by s2.admission_no loop
    v_i := v_i + 1;
    select coalesce(sum(amount),0) into v_fee from public.fee_items where class_id = st.class_id and term_id = v_term.id;
    if v_i % 5 in (1, 2) then v_pay := v_fee;            -- paid in full
    elsif v_i % 5 in (3, 4) then v_pay := round(v_fee * 0.5);  -- part payment
    else v_pay := 0; end if;                              -- nothing paid
    if v_pay > 0 then
      insert into public.payments (student_id, term_id, amount, paid_on, receipt_no, note)
      values (st.id, v_term.id, v_pay, least(current_date, v_term.start_date + 14 + (v_i % 40)), 'T-' || lpad(v_i::text, 4, '0'), 'Sample payment');
    end if;
  end loop;

  -- Weekly attendance: every Monday from the start of term up to today (at most 8 weeks)
  v_week := v_term.start_date + ((8 - extract(isodow from v_term.start_date)::int) % 7);
  v_i := 0;
  while v_week <= least(current_date, v_term.end_date) and v_i < 8 loop
    for c in select id from public.classes order by level_order limit 14 loop
      insert into public.attendance_weeks (class_id, term_id, week_start, school_days)
        values (c.id, v_term.id, v_week, 5) on conflict do nothing returning id into v_wk;
      if v_wk is not null then
        insert into public.attendance_entries (week_id, student_id, days_absent)
          select v_wk, id, case when random() < 0.7 then 0 when random() < 0.7 then 1 else 2 end
          from public.students where class_id = c.id and admission_no like 'TEST-%';
      end if;
      v_wk := null;
    end loop;
    v_week := v_week + 7; v_i := v_i + 1;
  end loop;

  -- Staff attendance for the last 3 days up to today
  for v_i in 0..2 loop
    if current_date - v_i between v_term.start_date and v_term.end_date then
      for sf in select id, row_number() over (order by phone) as rn from public.staff where phone like '0200000%' loop
        insert into public.staff_attendance (staff_id, attendance_date, term_id, status)
        values (sf.id, current_date - v_i, v_term.id,
                case when (sf.rn + v_i) % 6 = 0 then 'absent' when (sf.rn + v_i) % 5 = 0 then 'late' when (sf.rn + v_i) % 7 = 0 then 'on_leave' else 'present' end)
        on conflict do nothing;
      end loop;
    end if;
  end loop;

  -- Scores for scored classes. The last two students in each class are left without Mathematics, so you can
  -- try the "students still waiting" screen.
  for c in select id from public.classes where scored order by level_order limit 14 loop
    v_i := 0;
    for st in select id from public.students where class_id = c.id and admission_no like 'TEST-%' order by admission_no loop
      v_i := v_i + 1;
      for s in select cs.subject_id, sb.name from public.class_subjects cs join public.subjects sb on sb.id = cs.subject_id where cs.class_id = c.id loop
        continue when s.name = 'Mathematics' and v_i > 4;
        v_mark := least(100, greatest(8, round((35 + random() * 60)::numeric, 1)));  -- total out of 100
        insert into public.scores (student_id, subject_id, term_id, class_score, exam_score, is_absent)
          values (st.id, s.subject_id, v_term.id, round(v_mark * 0.3, 1), round(v_mark * 0.7, 1), false) on conflict do nothing;
      end loop;
      if v_i <= 4 then
        insert into public.report_remarks (student_id, term_id, teacher_remark, head_remark)
          values (st.id, v_term.id, 'Works hard and is polite in class.', 'Keep it up.') on conflict do nothing;
      end if;
    end loop;
  end loop;

  -- Notices
  insert into public.notices (title, body, audience) values
    ('[Sample] PTA meeting', 'The PTA meeting will be held on Friday at 10am in the school hall. All parents are welcome.', 'staff_and_parents'),
    ('[Sample] Staff meeting', 'Staff meeting on Monday after closing. Please bring your attendance registers.', 'staff');

  raise notice 'Sample data added: % students, 6 staff.', v_n;
end $$;
