-- supabase/migrations/20260220103000_add_zone_colors.sql
-- Add a color column to zones to support hierarchical color-coding
alter table public.zones
  add column if not exists color text;

alter table public.zones
  alter column color set default '#f4f4f5';

update public.zones
   set color = '#f4f4f5'
 where color is null;

alter table public.zones
  alter column color set not null;

alter table public.zones
  add constraint zones_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$');

-- Provide sensible defaults:
--  • Root zones (no parent) → subtle neutral background
--  • First-generation children → vivid baseline color
--  • Deeper descendants → slightly lighter than their parent
update public.zones
   set color = '#f4f4f5'
 where parent_id is null;

update public.zones
   set color = '#60a5fa'
 where parent_id is not null;

create or replace function public.lighten_hex_color(base text, factor double precision default 0.12)
returns text
language plpgsql
as $$
declare
  clean text;
  bytes bytea;
  r int;
  g int;
  b int;
  pct double precision := greatest(0.0, least(coalesce(factor, 0.12), 1.0));
begin
  if base is null then
    return '#f4f4f5';
  end if;

  clean := replace(base, '#', '');
  if length(clean) != 6 then
    raise exception 'Invalid hex color %', base;
  end if;

  bytes := decode(clean, 'hex');
  r := get_byte(bytes, 0);
  g := get_byte(bytes, 1);
  b := get_byte(bytes, 2);

  r := least(255, round(r + (255 - r) * pct));
  g := least(255, round(g + (255 - g) * pct));
  b := least(255, round(b + (255 - b) * pct));

  return '#' || lpad(to_hex(r), 2, '0') || lpad(to_hex(g), 2, '0') || lpad(to_hex(b), 2, '0');
end;
$$;

with recursive zone_tree as (
  select z.id, z.parent_id, z.color as computed_color
    from public.zones z
   where z.parent_id is null
  union all
  select c.id,
         c.parent_id,
         case
           when zone_tree.parent_id is null then c.color
           else public.lighten_hex_color(zone_tree.computed_color, 0.12)
         end as computed_color
    from public.zones c
    join zone_tree on c.parent_id = zone_tree.id
)
update public.zones as target
   set color = zone_tree.computed_color
  from zone_tree
 where target.id = zone_tree.id;
