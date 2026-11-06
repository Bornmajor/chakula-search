-- Tables, search function and insight views. Pure SQL: also runs in CI via PGlite.
create extension if not exists vector;

create table if not exists dishes (
  id                 bigint generated always as identity primary key,
  slug               text unique not null,
  name               text not null,
  description        text not null,
  category           text not null,
  price              int  not null check (price >= 0),          -- KES
  spice_level        smallint not null default 0 check (spice_level between 0 and 3),
  is_vegetarian      boolean not null default false,
  is_vegan           boolean not null default false,
  allergens          text[] not null default '{}',
  -- A human has checked the allergen list. Unverified dishes are NEVER returned
  -- for allergen-restricted searches.
  allergens_verified boolean not null default false,
  tags               text[] not null default '{}',
  image_path         text,                                       -- path inside the dish-images bucket
  sold_out           boolean not null default false,
  embedding          vector(384),                                -- gte-small
  created_at         timestamptz not null default now()
);

create table if not exists searches (
  id           bigint generated always as identity primary key,
  query        text not null,
  filters      jsonb,
  result_count int not null,
  mode         text,                                             -- ai | fallback | edited
  created_at   timestamptz not null default now()
);

-- Hard filters (price, diet, allergens, spice, sold-out) are enforced here, in SQL.
-- The AI only proposes values for them; it never decides what is safe to show.
-- Soft signals (vector similarity, tag overlap, keywords) only affect ranking.
create or replace function search_dishes(
  p_max_price         int     default null,
  p_min_price         int     default null,
  p_vegetarian        boolean default false,
  p_vegan             boolean default false,
  p_exclude_allergens text[]  default '{}',
  p_min_spice         int     default null,
  p_max_spice         int     default null,
  p_tags              text[]  default '{}',
  p_keywords          text[]  default '{}',
  p_strict_keywords   boolean default false,
  p_query_embedding   vector(384) default null,
  p_limit             int     default 12
) returns table (
  id bigint, slug text, name text, description text, category text, price int,
  spice_level smallint, is_vegetarian boolean, is_vegan boolean, allergens text[],
  tags text[], image_path text, sold_out boolean, score double precision
)
language sql stable as $$
  with scored as (
    select d.*,
      (select count(*) from unnest(p_keywords) k
        where d.name ilike '%' || k || '%'
           or d.description ilike '%' || k || '%'
           or array_to_string(d.tags, ' ') ilike '%' || k || '%') as kw_hits,
      cardinality(array(select unnest(d.tags) intersect select unnest(p_tags))) as tag_hits
    from dishes d
    where not d.sold_out
      and (p_max_price is null or d.price <= p_max_price)
      and (p_min_price is null or d.price >= p_min_price)
      and (p_min_spice is null or d.spice_level >= p_min_spice)
      and (p_max_spice is null or d.spice_level <= p_max_spice)
      and (not p_vegetarian or d.is_vegetarian)
      and (not p_vegan or d.is_vegan)
      and (cardinality(p_exclude_allergens) = 0
           or (d.allergens_verified and not (d.allergens && p_exclude_allergens)))
  )
  select s.id, s.slug, s.name, s.description, s.category, s.price, s.spice_level,
         s.is_vegetarian, s.is_vegan, s.allergens, s.tags, s.image_path, s.sold_out,
         (coalesce(1 - (s.embedding <=> p_query_embedding), 0)
            + 0.35 * s.tag_hits + 0.25 * s.kw_hits)::double precision as score
  from scored s
  where (not p_strict_keywords or s.kw_hits > 0)
  order by score desc, s.price asc
  limit p_limit
$$;

-- Owner insights
create or replace view top_searches with (security_invoker = true) as
  select lower(trim(query)) as query, count(*) as searches, round(avg(result_count), 1) as avg_results
  from searches group by 1 order by searches desc limit 50;

create or replace view zero_result_searches with (security_invoker = true) as
  select lower(trim(query)) as query, count(*) as searches, max(created_at) as last_seen
  from searches where result_count = 0 group by 1 order by searches desc limit 50;
