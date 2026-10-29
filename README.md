# Family Circle (Supabase version)

Family check-ins, family groups with invite codes, profile photos, call buttons, live family map, group and direct chat, day/night mode, themes and kids mode.

## How it works
`index.html` loads `supabase-shim.js`, which connects the app to the Supabase project and stores data in the table `public.fc_docs` with Row Level Security. Everything is shared live between signed-in family members.

## Run it
Host this folder on GitHub Pages (Settings > Pages > main branch), or open it with any static web server.

## One-time Supabase settings (dashboard)
1. Authentication > URL Configuration: set Site URL to your GitHub Pages address and add it under Redirect URLs.
2. Authentication > Providers > Email: keep Email on. Turn off "Allow new users to sign up" once everyone in your family has signed in, or invite them from Authentication > Users.
3. For many sign-ins, add your own email (SMTP) service. The built-in one only sends a few emails per hour.

## Automatic join
People whose email is in the Supabase table `fc_allowed` are put into the group "Our Family" the moment they sign in, so the chat works straight away. To add a family member, run in the Supabase SQL editor:

    insert into public.fc_allowed (email) values ('their.email@example.com');

## Family group
Sample group "Our Family", invite code K7FM2Q. Type the code in the Invite code box on the Family tab and press Enter.

## Privacy
Members of a group can read that group's cards and chat. Direct messages are visible only to the two people. Location, battery and photos are shared only when each person turns them on. Tell everyone before they join.
