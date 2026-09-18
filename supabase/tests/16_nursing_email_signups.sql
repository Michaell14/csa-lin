begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

select is(
  public.before_user_created_nursing_email('{"user":{"email":"nurse@nursing.upenn.edu","app_metadata":{"provider":"email"}}}'::jsonb),
  '{}'::jsonb, 'Nursing email signup is allowed');
select is(
  public.before_user_created_nursing_email('{"user":{"email":"NURSE@NURSING.UPENN.EDU","app_metadata":{"provider":"email"}}}'::jsonb),
  '{}'::jsonb, 'Nursing domain is case insensitive');
select is(
  public.before_user_created_nursing_email('{"user":{"email":"person@upenn.edu","app_metadata":{"provider":"email"}}}'::jsonb)
    -> 'error' ->> 'http_code',
  '403', 'plain Penn email signup is rejected');
select is(
  public.before_user_created_nursing_email('{"user":{"email":"person@gmail.com","app_metadata":{"provider":"email"}}}'::jsonb)
    -> 'error' ->> 'http_code',
  '403', 'personal email signup is rejected');
select is(
  public.before_user_created_nursing_email('{"user":{"email":"person@upenn.edu","app_metadata":{"provider":"google"}}}'::jsonb),
  '{}'::jsonb, 'Google signup remains allowed');

select * from finish();
rollback;
