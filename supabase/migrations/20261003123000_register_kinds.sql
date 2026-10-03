-- Risks and restrictive practices use the same log as incidents and complaints.

alter type public.incident_kind add value 'risk';
alter type public.incident_kind add value 'restrictive_practice';
