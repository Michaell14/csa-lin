-- Remove the retired feature and its data, including its old audit snapshots.
delete from public.changelog where table_name = 'lin_milestones';
drop table if exists public.lin_milestones;
drop function if exists public.set_milestone_creator();
