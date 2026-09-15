# CSA Lin Tree — Design Spec

Date: 2026-09-06
Status: Draft for review

## 1. Purpose

The UPenn Chinese Student Association runs a big/little mentorship program. Chains of bigs and littles form "lins" (lineages) that grow over many years, and today there is no durable record of them. This project is a website where Penn students can browse every lin as an interactive tree, members can maintain their own profile and family links, and CSA board members administer the data.

## 2. Users and roles

| Role | Who | Can do |
|---|---|---|
| Viewer | Anyone signed in with a Google account on a `upenn.edu` domain | Browse all lins, open any profile, search by name |
| Member | Viewer whose account is tied to a claimed profile | Everything a viewer can, plus edit own profile, propose big/little links, accept or decline link requests naming them, remove a confirmed link they are part of, rename and recolour a lin they founded |
| Admin | Member listed in the admins table | Everything a member can, plus create and edit any profile, hide profiles, merge duplicates, edit or delete any lin, create or delete any link without confirmation, resolve pending requests on anyone's behalf, promote or demote admins, view the changelog |

There is no anonymous access. There is no "delete person"; admins hide profiles instead. Hard deletes happen in the Supabase dashboard if ever needed.

## 3. Core concepts

- **Person**: one row per human. Exists before they ever sign in (admins seed profiles retroactively).
- **Link**: a directed big → little relationship. A person may have multiple bigs and multiple littles. The link graph is a directed acyclic graph, not a tree.
- **Lin**: a named lineage identified by a founder. Membership is derived, not stored: a lin consists of its founder plus every person reachable from the founder by following confirmed big → little links. A person with bigs from two lins is a member of both. Nobody creates a lin by hand: the database founds one the moment the first link in a chain is confirmed, with the person at the top of the chain as founder (see Section 8).
- **Claim**: the act of a person signing in with the Penn Google account whose email matches their profile, which binds that Google account to the profile.

## 4. Authentication and claiming

- Sign-in is Google OAuth through Supabase Auth.
- A server-side hook runs on every sign-in and accepts the account only if one of these holds:
  1. The email ends in `upenn.edu` (including subdomains such as `seas.upenn.edu`).
  2. The email equals the `personal_email` of an already-claimed profile.
  Any other account is rejected with the message "Please sign in with your Penn Google account."
- On an accepted sign-in with a Penn email, if an unclaimed person row has a matching `penn_email`, that row's `auth_user_id` and `claimed_at` are set. This is the only way to claim. Personal emails cannot claim.
- The hook adds a `person_id` claim to the access token (null for viewers). All "own row" authorization uses this claim.
- An accepted sign-in that matches no profile yields a viewer session. The UI shows a note: "You're not on a lin yet. Ask a CSA board member to add you."
- Once claimed, `penn_email` is locked. Members and admins may edit `personal_email` at any time.
- The lock is per statement: no single write, by any role, can change a claimed profile's `penn_email`. An admin may deliberately clear a claim (null `auth_user_id` and `claimed_at`) to recover a profile claimed by the wrong person, after which the Penn email is editable again. Both steps are recorded in the changelog with the acting admin. The intended flow is that members add a personal email before graduation so they keep edit access after their Penn email expires.

## 5. Data model (Postgres via Supabase)

### people
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| display_name | text, required | |
| grad_year | int, required | used for row placement and color |
| penn_email | text, unique, nullable | set by admin; locked once claimed |
| personal_email | text, unique, nullable | editable by member or admin |
| auth_user_id | uuid, unique, nullable | Supabase auth user; set on claim |
| claimed_at | timestamptz, nullable | |
| photo_path | text, nullable | Supabase storage path |
| major | text | |
| hometown | text | |
| bio | text | |
| instagram | text | handle only |
| linkedin | text | URL |
| hidden | bool, default false | hidden profiles are excluded from the graph |
| merged_into | uuid fk people, nullable | set when this row was merged into another |
| created_at, updated_at | timestamptz | |

### lins
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| name | text, unique, required | at most 120 characters; defaults to "<founder>'s Lin", numbered if taken |
| color | text, required | hex; dealt from the tree palette, least-used first |
| founder_id | uuid fk people, required | the top of the chain |
| created_at | timestamptz | |

### links
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| big_id | uuid fk people, required | |
| little_id | uuid fk people, required | |
| academic_year | text, nullable | e.g. "2024-25" |
| status | enum: pending, confirmed | admin-created links start confirmed |
| proposed_by | uuid fk people, nullable | null when admin-created |
| confirmed_by | uuid fk people, nullable | |
| created_at, confirmed_at | timestamptz | |

Constraints:
- `big_id <> little_id`.
- Unique on `(big_id, little_id)`.
- A trigger rejects any insert or status change to confirmed that would create a cycle (i.e. `little_id` is already an ancestor of `big_id` through confirmed links).

### admins
| column | type | notes |
|---|---|---|
| person_id | uuid pk fk people | |
| granted_by | uuid fk people | |
| granted_at | timestamptz | |

### changelog
| column | type | notes |
|---|---|---|
| id | bigserial pk | |
| actor_id | uuid fk people, nullable | null for system actions such as auto-claim |
| table_name | text | |
| row_id | uuid | |
| action | enum: insert, update, delete | |
| before | jsonb, nullable | |
| after | jsonb, nullable | |
| created_at | timestamptz | |

Populated by triggers on people, lins, links, and admins.

### Derived queries
- **Ancestors / descendants of a person**: recursive CTE over confirmed links.
- **Members of a lin**: founder plus descendants of founder, excluding hidden and merged people. The founder is always returned even if hidden, flagged so the UI can draw a placeholder.
- **Lins a person belongs to**: every lin whose founder is the person or one of their ancestors.
- **Founding a lin** (`links_found_lin` trigger, on a link becoming confirmed): if the big already belongs to a lin, nothing. Otherwise the lin belongs at the top of the big's chain (the big, or the ancestors of theirs with no confirmed big; two such tops mean two lins). A lin the little had founded is handed up to that top rather than nested inside a new one; failing that, a new lin is inserted with the top as founder.
- **Lin graph** (`lin_graph(lin uuid) returns jsonb`): the one-call contract the frontend draws from. Returns `{"people": [...], "links": [...]}` with hidden and merged people removed, the founder always present (as a nameless placeholder with no profile fields if hidden), every link confirmed and connecting two returned people, and no email or auth columns on any node. Pending links are not included; the client reads those from `links` directly.

These are exposed as Postgres functions and called from the app.

## 6. Authorization (Row Level Security)

All access control is enforced with Supabase RLS policies. The web app never has more power than the signed-in user.

- **people**: any authenticated user can select rows where `hidden = false` and `merged_into is null`. A member can update their own row (matched by the `person_id` claim the auth hook stamps into the JWT, so Penn-email and personal-email logins resolve to the same profile), but not `penn_email`, `hidden`, `merged_into`, `auth_user_id`, or `claimed_at`. Admins can insert and update any row. Nobody can delete.
- **lins**: any authenticated user can select. The founder can update their own lin's name and colour (a guard trigger keeps `founder_id`, `id` and `created_at` admin-only). Admins can update and delete any lin. Inserts come from the `links_found_lin` trigger, which runs as the database owner; the direct insert policy stays admin-only so a member cannot invent a lin with an arbitrary founder.
- **links**: any authenticated user can select confirmed links, plus pending links where they are big, little, or proposer. A member can insert a pending link where they are big or little and `proposed_by` is themselves. A member can update a pending link to confirmed if they are the other party. A member can delete a confirmed or pending link they are part of. Admins can insert (confirmed), update, and delete any link.
- **admins**: any authenticated user can select (needed to render admin UI). Only admins can insert or delete.
- **changelog**: only admins can select. Inserts happen via triggers only.
- **storage (photos)**: any authenticated user can read. A member can write only under a folder named by their own person id. Admins can write anywhere. Uploads capped at 2 MB, images only.

The sign-in acceptance rule in Section 4 is the one check that lives outside RLS, in a Supabase Auth hook.

## 7. User interface

Single-page app with one main screen and one admin screen.

### Top bar
- App name, lin tabs (one per lin, colored), a person search box, and the signed-in user's avatar. The avatar shows a badge with the count of pending link requests naming them.

### Lin view
- The selected lin is drawn top-down. Rows are grad years, founder's year at the top. Layout is computed client-side with dagre, a layered DAG layout library. A person with two bigs is placed between them with two incoming edges.
- Each person is a name pill: small circular avatar, display name, grad year, pill border in the grad-year color. Unclaimed profiles show a dashed grey avatar.
- Pan and zoom with mouse and trackpad. A "fit to screen" button resets the view.
- Search selects a person and switches to one of their lins with them selected and centered.
- The lin's founder (or an admin) has an Edit lin control for its name and colour.
- The whole lin (people plus links) loads in one request via `lin_graph`.

### Side panel
- Opens on the right when a person is clicked (bottom sheet on narrow screens).
- Shows photo, name, grad year, major, hometown, bio, socials, and the person's lins (switchable if more than one).
- Lists bigs and littles as clickable pills that re-center the graph on that person.
- If the panel shows the signed-in member's own profile: an Edit button, an "Add a big" and "Add a little" button, a list of their pending requests with Accept and Decline, and a Remove control next to each confirmed link.

### Admin screen (admins only)
- **People**: searchable table; add person (name, grad year, Penn email) with a live near-match warning; inline edit; hide toggle; bulk add by pasting CSV rows of `name, grad_year, penn_email`; merge two people (moves all links to the survivor, sets `merged_into` on the other).
- **Links**: from a person row, add a big or little by picking a name. Created as confirmed.
- **Lins**: edit name, color, founder; delete. Lins are not created here.
- **Pending requests**: all pending links with Accept or Reject.
- **Admins**: promote or demote by picking a person. An admin cannot demote themselves if they are the last admin.
- **Changelog**: read-only paginated list.

## 8. Member flows

- **Claim**: automatic on first Penn sign-in (Section 4).
- **Edit profile**: fields in Section 5, photo upload.
- **Propose a link**: pick a person from search. Creates a pending link. The other party sees the badge and the request in their own panel. If an identical confirmed or pending link exists, the UI shows it instead of creating a duplicate.
- **Accept or decline**: accepting sets status to confirmed and `confirmed_by`. Declining deletes the pending link.
- **Founding a lin**: confirming a link is the two-party agreement that a lin exists, so no admin is involved. If the big is not in a lin yet, one is founded at the top of their chain, named "<founder>'s Lin" in the next free palette colour; a lin the little had founded is handed up to that top instead. The founder can rename and recolour it. A lin outlives the link that founded it, and one that a later link places inside another lin is kept (its people are then in both); admins can delete either.
- **Remove a link**: deletes it. Logged in changelog.

There are no notifications outside the app in version one.

## 9. Edge cases

- **Cycle**: rejected by the database trigger. The UI shows "That would make someone their own ancestor."
- **Duplicate people**: mitigated by the near-match warning on add, resolved by the merge action.
- **Email typo on unclaimed profile**: admin edits `penn_email`. Locked after claim.
- **Non-Penn, unmatched account**: rejected at sign-in with a plain message.
- **Hidden founder**: the lin still renders from the founder's descendants; the founder appears as a placeholder pill.
- **Person in several lins**: appears in each lin's graph. Side panel shows all their lins.
- **Alumni losing Penn email**: continue signing in with `personal_email` if they set one. Otherwise their profile remains visible but they can't edit until an admin adds a personal email for them.

## 10. Out of scope for version one

- Email or push notifications.
- Messaging between members.
- Public (unauthenticated) viewing.
- PennKey / Penn SSO.
- Whole-org graph showing all lins at once. Per-lin views only; cross-lin membership is shown through the side panel.
- Hard deletion of people from the UI.

## 11. Tech stack and deployment

- **Frontend**: Next.js (App Router), TypeScript, React. Graph rendering with React Flow, layout with dagre.
- **Backend**: Supabase (Postgres, Auth with Google provider, Storage, RLS). Business rules live in SQL: triggers for cycle prevention and changelog, functions for ancestry queries.
- **Hosting**: Vercel free tier for the app, Supabase free tier for data. Note: Supabase pauses inactive free projects after about a week; they resume on the next request.
- **Handoff**: a README that walks a new maintainer through creating the Supabase project, enabling Google auth, running migrations, setting Vercel environment variables, and making the first admin.

## 12. Testing

- **RLS policy tests** (highest priority): run as viewer, member, other member, and admin; assert allowed and denied reads and writes for every table.
- **Graph query tests**: fixture graph with a two-big person and a descendant shared between two lins; assert ancestors, descendants, lin membership, and cycle rejection.
- **Auth hook tests**: unclaimed Penn email claims; claimed Penn email signs in; personal email on claimed profile signs in; unrelated email rejected; personal email on unclaimed profile rejected.
- **Component tests**: a fixture lin renders each person once and each link once; search selects and centers the right person; own-profile panel shows edit controls and other-profile panel does not.
- **No end-to-end browser tests** in version one. Manual smoke check before each deploy.
