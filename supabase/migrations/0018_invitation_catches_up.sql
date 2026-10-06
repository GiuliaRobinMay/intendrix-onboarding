-- Intendrix — an invitation finds the person even if they are already here
--
-- Access was granted in one instant only: when an account was created,
-- the database looked for an invitation with that address and copied
-- its role in. Anybody who signed up before their invitation existed
-- got a profile with no role — and nothing ever came back to it.
--
-- That is not a rare corner. It is what happens whenever someone makes
-- an account first and is invited after, which is the ordinary order of
-- events. Three of the four people on the team landed in it, and all
-- three silently saw the app's demo data instead of their own, for
-- weeks, with nothing anywhere saying why.
--
-- So an invitation now also works backwards: creating one for an
-- address that already has an account applies it there and then.

create or replace function apply_invitation_to_existing_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare hit profiles%rowtype;
begin
  select * into hit
    from profiles
   where lower(email) = lower(new.email)
   limit 1;

  -- nobody with that address yet: the sign-up trigger will pick the
  -- invitation up when they arrive, exactly as before
  if hit.id is null then
    return new;
  end if;

  -- somebody already here, and still without access: give it to them
  if hit.role is null then
    update profiles
       set role      = new.role,
           client_id = new.client_id,
           staff_id  = coalesce(new.staff_id, staff_id)
     where id = hit.id;
    update invitations set accepted_at = now() where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_invitation_created on invitations;
create trigger on_invitation_created
  after insert on invitations
  for each row execute function apply_invitation_to_existing_user();

comment on function apply_invitation_to_existing_user is
  'An invitation for an address that already has an account grants it immediately, instead of waiting for a sign-up that already happened.';
