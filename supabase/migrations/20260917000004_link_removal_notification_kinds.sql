-- Enum additions must commit before the next migration inserts these values.
alter type public.notification_kind add value 'link_removal_approved';
alter type public.notification_kind add value 'link_removal_rejected';
