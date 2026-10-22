# CHESSINEMA Registration

A registration page with static HTML/CSS plus two Vercel serverless API routes:

- `index.html` — page content and form markup
- `styles.css` — theme, layout, and the original animations
- `app.js` — browser-side validation; calls the same-origin `/api` routes
- `api/register.js` — validates the request and calls the registration RPC
- `api/ticket-count.js` — calls the aggregate-only ticket-count RPC
- `lib/supabase.js` — creates the server-side Supabase client from environment variables

The Halloween palette now uses a warmer ember-and-burgundy background. The existing CSS animation keyframes were kept unchanged. The unsafe browser-side admin key panel was removed.

## Deploy to Vercel

1. Push the contents of this folder to a GitHub repository. The root of the deployed project should contain `index.html`, `package.json`, `api/`, and `lib/`.
2. In Vercel, choose **Add New → Project**, import the GitHub repository, set the Root Directory to the folder containing `index.html`, and choose **Other** if it asks for a framework. Leave the build command empty. Vercel runs Node.js functions from the root `api/` directory and installs dependencies from `package.json`; see [Vercel's Node.js runtime guide](https://vercel.com/docs/functions/runtimes/node-js).
3. In the Vercel project, open **Settings → Environment Variables** and add:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | Your Supabase project URL |
   | `SUPABASE_PUBLISHABLE_KEY` | The Supabase publishable key (`sb_publishable_…`) |

   Select Production, Preview, and Development if you want each deployment type to work. If Vercel offers a Config/Secret visibility choice, `SUPABASE_URL` can be Config and the key can be Secret/Sensitive. For a legacy Supabase project that only has an `anon` key, add `SUPABASE_ANON_KEY` instead; the code supports either key name.
4. Save the variables, then redeploy so the new deployment receives them. Vercel Functions read these values through `process.env`; the static files do not.
5. Check the deployed page: the seat count should load, a valid registration should succeed, and invalid/used tickets or duplicate email/CIN should show the expected message.

Vercel’s dashboard stores environment variables outside the source repository; changes apply to new deployments, so redeploy after changing them. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

### Local testing (optional)

1. Install Node.js, then run `npm install` in the project folder.
2. Install or run the Vercel CLI (`npm i -g vercel`), link this folder with `vercel link`, and pull the Development variables with `vercel env pull .env.local`.
3. Run `vercel dev` and open the local URL it prints. `.env.local` is ignored by Git; never commit it.

## Supabase security checklist

The Vercel functions use `SUPABASE_PUBLISHABLE_KEY` (or the legacy `SUPABASE_ANON_KEY`) on the server. A publishable/anon key is not a secret; the important boundary is still RLS and database grants. Supabase recommends publishable keys for public-facing components, and says secret/service-role keys bypass RLS and must stay server-side. See [Supabase's secure data guide](https://supabase.com/docs/guides/database/secure-data).

1. Do **not** add a Supabase secret/service-role key to the browser, GitHub repository, `.env.example`, or a frontend build variable. The current registration and count functions do not need one.
2. Enable RLS on the tables. Deny public direct reads/writes to registrations and tickets. Grant the publishable/anon role execution only on the specific RPCs that the site needs.
3. Review `register_chessinema`: it should validate and atomically claim one unused ticket, reject duplicate email/CIN values, insert the registration, and return only a minimal success/error result. Enforce uniqueness in the database too. If it uses `SECURITY DEFINER`, set a fixed safe `search_path`, qualify table names, and grant execution only to the roles that need it.
4. The page calls a count-only RPC named `get_available_ticket_count`. Add it as a `SECURITY DEFINER` function that returns only the number of unused tickets; do not grant direct `SELECT` access to `tickets` just to display the count. Example, assuming the existing `tickets.is_used` column:

   ```sql
   create or replace function public.get_available_ticket_count()
   returns bigint
   language sql
   security definer
   set search_path = ''
   as $$
     select count(*) from public.tickets where is_used = false;
   $$;

   revoke all on function public.get_available_ticket_count() from public;
   grant execute on function public.get_available_ticket_count() to anon, authenticated;
   ```

   Review that this function returns no ticket numbers or registration data.
5. Test with the publishable/anon key: direct table reads/writes should be denied; a valid ticket should register once; invalid or already-used tickets and duplicate email/CIN should fail; two simultaneous attempts for one ticket should produce at most one success.

The page calls `register_chessinema` with the parameters shown in `api/register.js`, plus `get_available_ticket_count` for the public seat counter.

## Add secure admin tools later

The previous admin panel accepted a Service Role key in the browser. That was not safe, even though it said the key was only kept in the browser session. Admin functions such as adding tickets or viewing registration statistics should instead use one of these patterns:

- **Recommended for private admin actions:** add a protected Vercel API route or Supabase Edge Function. Require an authenticated admin, check the admin role server-side, validate inputs, and store any elevated key as a server-only environment variable. The browser sends a user session token, never the secret key.
- **For limited table operations:** use Supabase Auth and RLS policies that allow only authenticated users with an admin role to perform specific actions. Do not grant broad table access to the anon role.

If a secret/service-role key was ever committed or pasted into a publicly accessible page, rotate it in Supabase before continuing. Add rate limiting or CAPTCHA before opening a public registration endpoint to broad traffic; server-side validation does not stop automated request spam.
