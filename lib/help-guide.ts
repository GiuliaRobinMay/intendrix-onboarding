// The written knowledge behind the "Need help?" assistant: one full guide
// (the assistant's system prompt) and the same material cut into topics
// for the built-in browser, which also answers when no assistant is
// configured. When the app changes, this file is part of the change.

export const APP_GUIDE = `You are the in-app help assistant for Intendrix, the Phoenix Performance team's tool for running lesson-drip email campaigns for their leadership programs (the Transformational Leadership Experience, TLE). Answer questions about HOW TO USE THIS APP, and about the community work that surrounds it — creating a client's space in Mighty Networks, making their invitation plan, and inviting their team in (SOP-01, SOP-02, SOP-03). Be brief and concrete: short sentences, numbered steps, plain language, no jargon. Answer in the language the user writes in. Never invent features that are not described below. If something is not covered here, say so and suggest asking Giulia (the app's builder) instead of guessing. The SOP documents themselves, with their walkthrough videos and PDFs, live at https://ph-community-sop-ai.vercel.app/ — point people there when they want the document rather than the answer.

HOW THE APP IS ORGANISED
- Clients are organizations. Each client has members (the people who receive lesson emails), a Location (state and city; the state decides which timezone new campaigns start in), Phoenix responsibles (Leader, Coach, Project Manager; the Coach is who emails are sent from), and campaigns.
- A campaign is one run of a program for one client, created from a blueprint (e.g. TLE for Leaders). It has sessions (live meetings) and series of lessons. Each series is triggered by one session: the session's date starts that series' email schedule.
- Members have a role: Participant (gets the normal emails), Leader (gets the Leader version with Leaders Guides), Coach (gets a copy of every send). The campaign page also has a small team table for coordinators; receiving emails is decided by the client's member list, not that table.

SCHEDULING
- Email dates are computed: session date plus each lesson's offset in working days (weekends and US federal holidays are skipped). All lessons send at 8:00 AM in the campaign's timezone (the timezone dropdown on the campaign page).
- The engine passes twice a day. An email goes out in the first pass after 8:00 AM its campaign's local time - Eastern campaigns around 8:15 AM Eastern, Pacific around 9:15 AM Pacific.
- To move ONE email: open it (mailbox, or the arrow on the campaign's lesson row) and pick a new date on its Date line. Only that email moves; it gets a yellow "moved by hand" mark; "Back to automatic" returns it to the calculated date.
- Moving a SESSION's date moves every lesson that hangs off it (except hand-pinned ones).
- An email more than 2 days overdue is never sent automatically - it is held, so switching the engine on can never flood people with a backlog. Send it by hand or cancel it.

THE MASTER SWITCH
- Settings has an "Email sending" ON/OFF switch. OFF means the daily engine sends nothing at all, ever. The "Send to everyone now" button on an email works regardless of the switch - it sends exactly that one email because a person explicitly asked.

STATUSES ON EMAILS
- Scheduled: on the calendar, will send on its date. Sent (green): really delivered - this comes from the send log, never just the calendar. Not sent (orange): the date passed but nothing went out. Cancelled: never sends for this campaign, restorable. Awaiting date: its trigger session has no date yet.

THE MAILBOX
- Every planned and sent email across all campaigns. Open one to read it. Click the subject or the text to edit them - edits change ONLY that campaign's email; the master template in Settings stays untouched. An edited email shows "Own wording for this campaign" with "Reset to master".
- "Send me a test" sends the email to your own inbox only, marked TEST.
- "Send to everyone now" really sends to all members immediately, after a popup with the exact numbers. People who already received it are skipped automatically, so it is also the way to catch up someone added later.
- "Don't send this email" cancels it for that campaign (popup first); "Restore it" undoes that.
- The Delivery panel on a sent email shows sent / delivered / opened / clicked / bounced counts and a per-person list ("Who?"). Opens undercount (many mail programs block the tracking image); clicks are the reliable number.

MEMBERS
- On the client page: search box next to the Members title; a role dropdown per person; an info button per row showing first name, last name, title, email (all editable) and the emails that person received; a trashcan with a confirmation. Removing a member stops future emails; history stays.

SENDERS AND EXTRAS
- Emails are sent from the campaign's Phoenix Coach. A campaign can instead nominate a client member (e.g. their Transformational Champion) in "Emails sent by": recipients see that name, replies go to them, the address stays on the sending domain.
- "Send a copy of everything to": comma-separated addresses that get one copy of each lesson without being members.
- Each Phoenix person has a signature (Settings, Team); a company logo can be set there too.
- Every email supports {{first_name}}, {{name}}, {{client}}, {{sender}} merge fields, one attachment, and lesson links.

MASTER TEMPLATES
- Settings, Campaigns holds the blueprints and their lesson emails. Editing there changes the master for EVERY campaign using that blueprint. Editing in the mailbox changes one campaign only.

DELETING AND SAFETY
- Everything deletable has a trashcan with an "are you sure" popup. A client whose campaigns have really sent emails cannot be deleted at all (its bin is faded) - archive it instead (status dropdown on the client page). Deleting a client removes its members and campaigns with it.

WHO CAN DO WHAT
- Phoenix admins see everything and can send. Client admins see only their own organization and cannot send. People are invited from Settings, Team.

THE COMMUNITY SIDE — SPACES, PLANS AND INVITATIONS (SOP-01 to SOP-03)
This is work done in Mighty Networks (intendrix.ai), not in this app. The order matters: a plan points at a space, and an invitation link comes from a plan, so skipping ahead produces links that lead nowhere.
- SOP-01, create the space (~30 min). Never build from scratch: sidebar, ADMIN ONLY, Client Space Template, three dots, More, Duplicate - and choose "Duplicate all posts", the other options leave it empty. Then Manage, Move Space, TEAM CONNECT; rename it to the client's name exactly as they write it (no "[Copy]", no suffix); reorder TEAM CONNECT alphabetically. Then the Start Here post and the Welcome page.
- Branding comes next, always before anyone is invited: logo, hero banner, imagery.
- SOP-02, create the plan (~20 min). Gear icon, Plans & Access, Plans; duplicate Client Plan Template; point it at the client's space (this is the step that personalises the invitation link - the wrong space sends the client into another client's environment); name it "<Client name> | Intendrix Full Access"; plan card image at least 1600x900; press Create Share Links, or the plan exists and the link does not; press Save Changes, there is no autosave. Record all three links in the master sheet.
- SOP-03, invite the team (~5 min). The invitation link is the plan's "Plan Landing Page" link - the first one, not the Advanced Options links below it. A complete link contains "?bundle_token=" and ends with "&utm_source=manual".
- The master sheet "Intendrix - Client Spaces, Plans & Invite Links" holds every client's links. Column D is the invitation link, the only one you ever send. Copy it from the formula bar, not the cell - Google Sheets cuts the visible text at the column edge, and a half-copied link is the commonest reason an invitation fails.
- Treat the invitation link like a password: anyone holding it can join that client's environment. Never post it in a shared channel.
- Verify before sending: open the plan's Members tab, three dots on a member's row, View as. Check that under TEAM CONNECT they see only their own team space. Exit before doing anything else. If they can see another client's space, do not send - fix Space Access on the plan's Settings tab first.
- What an invitation email must contain: the invitation link and no other link; what happens when they click; the account-creation steps spelled out; where they will arrive (A Warm Welcome, then their team space under TEAM CONNECT); a named person to contact; and the member guide PDF attached. The app's own "Invite to the community" button sends exactly this.
- How a member joins: open the link, click the big red Access button - NOT Sign in at the top, which is only for people who already have an account and is the single most common reason somebody cannot get in - create the account with their work email, accept the terms (only the first tick box is required), add a photo or skip, and they arrive in A Warm Welcome. Tell them to bookmark the page - the invitation link was for setting up, the bookmark is how they come back.
- When a member cannot get in: a link that will not open was cut in half by their email programme - resend it complete. "You are already a member" means they should Sign In, not sign up. On the phone they must use the same sign-in method as on the computer, or they create a second, empty account.
- Words: Network is the whole community. A Space is one area in it. A Plan is the access rule - which spaces a person may enter. Bundle is the plan type used for clients. Hidden means the plan is reachable only by its link. The Plan Landing Page is the page the invitation link opens. The bundle token is the code inside that link that grants access. TEAM CONNECT is the sidebar group holding every client's team space. View as is the admin preview through a member's eyes.
- The mistakes that actually happen: leaving the space in ADMIN ONLY so the client cannot see it; picking the wrong duplicate option; changing the Welcome page body but not its title, so the previous client's name survives; pointing the plan at the wrong space; forgetting Create Share Links; forgetting Save Changes; sending a space link instead of the invitation link.`;

export interface HelpTopic {
  title: string;
  body: string;
  keywords: string;
  /** which group it sits under on the Help page */
  category: HelpCategory;
}

/** The six groups the Help page is built from, in the order it shows
 *  them. A topic with no obvious home belongs in "Day to day" — the
 *  list is for finding things, not for filing them. */
export const HELP_CATEGORIES = [
  "Getting started",
  "Setting up a client",
  "The community",
  "Emails and scheduling",
  "Day to day",
  "When something looks wrong",
] as const;

export type HelpCategory = (typeof HELP_CATEGORIES)[number];

export const HELP_TOPICS: HelpTopic[] = [
  {
    title: "When do emails go out?",
    body: "Every lesson sends at 8:00 AM in its campaign's timezone (the dropdown on the campaign page). The engine passes twice a day and sends in the first pass after 8:00 local - Eastern campaigns around 8:15 AM Eastern, Pacific around 9:15 AM Pacific. The master switch in Settings must be ON for the engine to send anything.",
    keywords: "time hour when send morning 8am timezone engine schedule",
    category: "Emails and scheduling",
  },
  {
    title: "Move one email to another date",
    body: "Open the email (in the Mailbox, or via the arrow on the campaign's lesson row) and pick a date on its Date line. Only that email moves - it gets a yellow 'moved by hand' mark, and 'Back to automatic' returns it to the calculated date. Moving a session's date moves all its lessons at once instead.",
    keywords: "date change move reschedule pin individual email later earlier",
    category: "Emails and scheduling",
  },
  {
    title: "Send an email right now",
    body: "Open the email and press 'Send to everyone now'. A popup shows exactly who will get it before anything leaves. People who already received it are skipped, so pressing it again is harmless - and it is also how you catch up someone who was added later. It works even when the master switch is OFF.",
    keywords: "send now immediately button manual everyone catch up",
    category: "Emails and scheduling",
  },
  {
    title: "Stop an email from being sent",
    body: "Open the email and press 'Don't send this email'. It stays in the list with the status Cancelled and the engine never sends it for that campaign. 'Restore it' undoes the cancel. To stop a whole campaign, set its status to Paused on the campaign page. To stop everything, switch Email sending OFF in Settings.",
    keywords: "cancel stop don't send skip pause hold block",
    category: "Emails and scheduling",
  },
  {
    title: "Change an email's text for one campaign",
    body: "Open the email in the Mailbox and click its subject or text to edit. Your wording applies to that campaign only - the master template stays untouched, and the email shows 'Own wording for this campaign' with a 'Reset to master' link. To change the wording for every campaign, edit the master under Settings > Campaigns.",
    keywords: "edit text subject wording copy template master change email",
    category: "Emails and scheduling",
  },
  {
    title: "What the statuses mean",
    body: "Scheduled: on the calendar, will send on its date. Sent (green): really delivered - it comes from the send log, never just the calendar. Not sent (orange): the date passed but nothing went out. Cancelled: never sends for this campaign. Awaiting date: the trigger session has no date yet.",
    keywords: "status not sent cancelled scheduled awaiting green orange meaning why says shows",
    category: "Emails and scheduling",
  },
  {
    title: "Did someone get their email?",
    body: "Per email: open it and look at the Delivery panel - sent, delivered, opened, clicked, bounced, and 'Who?' lists every person. Per person: on the client page, open the info button on their member row to see every email they received. Opens undercount because many mail programs block the tracking image - clicks are the reliable signal. Bounced (red) means the address is bad: fix it on the member and use 'Send to everyone now' to resend to just them.",
    keywords: "delivered opened clicked bounced received check person individual delivery report",
    category: "When something looks wrong",
  },
  {
    title: "Test an email on yourself",
    body: "Open the email and press 'Send me a test'. It goes only to your own inbox, marked TEST in the subject with a banner, so it can never be mistaken for the real thing. Members never see test sends.",
    keywords: "test preview try myself inbox check before",
    category: "Day to day",
  },
  {
    title: "Add people to a client",
    body: "On the client page, use the + next to Members, or ask Giulia to import a list. Each person has a role: Participant gets the normal emails, Leader gets the Leader version with the Leaders Guides, Coach gets a copy of every send. Everyone in the member list receives the client's campaign emails - the small team table on the campaign page is only for coordinators.",
    keywords: "add member people import participant leader role team",
    category: "Setting up a client",
  },
  {
    title: "Who emails are sent from",
    body: "The campaign's Phoenix Coach (set on the client or campaign page). A campaign can instead nominate one of the client's own people in 'Emails sent by' - recipients see that person's name and replies reach them, while the address stays on the sending domain. Signatures and the company logo live under Settings > Team.",
    keywords: "sender from coach champion reply signature logo who sends",
    category: "Setting up a client",
  },
  {
    title: "Copies for people watching a campaign",
    body: "On the campaign page, the field 'Send a copy of everything to' takes comma-separated addresses. Each gets one copy of every lesson as it goes out - without being a member, without personalisation, marked with the client's name in the subject. Remove an address from the field to stop the copies.",
    keywords: "copy watcher cc shadow monitor coordinator receive everything",
    category: "Day to day",
  },
  {
    title: "The master switch",
    body: "Settings > Email sending. OFF means the daily engine never sends anything, no matter what is due. ON means everything scheduled goes out automatically on its date. The 'Send to everyone now' button works in both positions, because it sends only what you explicitly confirm. An email more than 2 days overdue is never auto-sent even when ON - it is held, to prevent backlog floods.",
    keywords: "switch on off master engine automatic sending enable disable",
    category: "Day to day",
  },
  {
    title: "Deleting things safely",
    body: "Everything deletable has a trashcan with an 'are you sure' popup naming what goes. A client whose campaigns have really sent emails cannot be deleted at all (faded bin) - archive it instead via the status dropdown on its page. Removing a member stops their future emails; what they already received stays in the log.",
    keywords: "delete remove trash bin faded archive cannot protect",
    category: "Day to day",
  },
  {
    title: "Timezones and locations",
    body: "Each client has a Location card (state + city). The state decides which timezone NEW campaigns start with, so emails land at 8:00 AM in the client's own morning. An existing campaign's timezone is its own dropdown on the campaign page. Without a state, new campaigns fall back to Eastern.",
    keywords: "timezone state city location pacific eastern hour zone",
    category: "Setting up a client",
  },
  {
    title: "Add a new member to a client team",
    body: "One link does it: the client's invitation link, which is the Plan Landing Page link of their plan. It routes the person into the right team space on its own - you never add people to a space by hand. Find it in the master sheet 'Intendrix - Client Spaces, Plans & Invite Links', column D, and copy it from the formula bar, not the cell: Sheets cuts the visible text at the column edge, and a half-copied link is the commonest reason an invitation fails. A complete link contains ?bundle_token= and ends with &utm_source=manual. Treat it like a password - anyone holding it can join that client's environment.",
    keywords: "add member new member invite someone join team person plan landing page master sheet bundle token",
    category: "The community",
  },
  {
    title: "What the invitation email must say",
    body: "Six things: the invitation link and no other link; what happens when they click; the account-creation steps spelled out, so nobody stalls at the sign-up screen; where they will arrive (A Warm Welcome, then their own team space under TEAM CONNECT); a named person to contact if it does not work; and the member guide PDF attached. The app's own 'Invite to the community' button sends exactly this, with the guide attached - use it rather than writing the email by hand.",
    keywords: "invitation email what to send wording template message invite mail attachment guide",
    category: "The community",
  },
  {
    title: "Create a new client space",
    body: "In Mighty Networks, not here, and never from scratch - duplicate the template so nothing is forgotten. Sidebar, ADMIN ONLY, Client Space Template, three dots, More, Duplicate, and choose 'Duplicate all posts'; the other two options leave it empty. When the copy is ready: three dots, Manage, Move Space, TEAM CONNECT. Rename it to the client's name exactly as they write it - no '[Copy]', no suffix. Reorder TEAM CONNECT alphabetically. Then the Start Here post and the Welcome page, and remember to change the Welcome page's title as well as its body, or the previous client's name survives. About 30 minutes. Branding comes after, always before anyone is invited.",
    keywords: "new space create space client space duplicate template sop-01 team connect",
    category: "The community",
  },
  {
    title: "Create the invitation plan",
    body: "The plan unlocks a client's space and produces the link you send. One per client, made after the space exists and is branded. Gear icon, Plans & Access, Plans; find Client Plan Template, three dots, Duplicate. Point it at the client's space - this is the step that personalises the link, and the wrong space sends the client into another client's environment. Name it '<Client name> | Intendrix Full Access'. The plan card image must be at least 1600x900. Press Create Share Links or the plan exists and the link does not, and press Save Changes - there is no autosave. Record all three links in the master sheet. About 20 minutes.",
    keywords: "plan create plan invitation plan sop-02 bundle share links plan card",
    category: "The community",
  },
  {
    title: "Check a client cannot see another client",
    body: "Two minutes that prevent the worst mistake. Open the plan's Members tab, click the three dots on any member's row, and under MANAGE choose 'View as'. A grey bar confirms whose view you are in. In the left sidebar they should see the whole community, but under TEAM CONNECT only their own team space. Click Exit on the grey bar before doing anything else. If they can see another client's space, do not send the invitation: go to the plan's Settings tab, Space Access, remove every TEAM CONNECT space except theirs, and preview again. Do this once per new client, and any time you change a plan's space access.",
    keywords: "view as verify check access preview before sending space access wrong client security",
    category: "The community",
  },
  {
    title: "How a member joins",
    body: "What happens on their side, about three minutes in any browser, nothing to install. They open the invitation link, click the big red Access button on the welcome page - not Sign in at the top, which is only for people who already have an account - create an account with first name, last name, email and password (work email is best) or a Google/Apple/LinkedIn/Facebook button, accept the terms - only the first tick box is required - add a photo or skip, and arrive in A Warm Welcome with their team's space in the sidebar under TEAM CONNECT. Tell them to bookmark the page: the invitation link was for setting up, the bookmark is how they come back.",
    keywords: "join sign up create account member steps how to join access button bookmark",
    category: "The community",
  },
  {
    title: "A member cannot get in",
    body: "They pressed Sign in instead of Access: by far the most common one. Sign in asks for a password they never made, so it can only fail on a first visit. Tell them to go back to the invitation link and press the big red Access button. Link will not open: their email programme cut it in half - resend it complete, copied from the formula bar, ending in &utm_source=manual. 'You are already a member': they have an account here, so Sign In instead of signing up. The phone app asks them to sign up again: they must use exactly the same method as on the computer, same email and password or the same Google/Apple button - a different method starts a second, empty account. Forgotten password: use the forgotten-password link on the sign-in screen. Cannot find their team space: look under TEAM CONNECT, and if it is not there check the plan's Space Access.",
    keywords: "cannot get in problem trouble link broken already a member password app second account missing space",
    category: "When something looks wrong",
  },
  {
    title: "The order of the SOPs",
    body: "Each step depends on the one before, because a plan points at a space and a link comes from a plan. SOP-01, create the space, about 30 minutes. Then the Branding SOP - logo, hero banner, imagery - always before anyone is invited. SOP-02, create the invitation plan, about 20 minutes. SOP-03, invite the team, about 5 minutes: verify with View as, then send the Plan Landing Page link with the account steps. SOP-04 is the client-facing onboarding guide. Skipping ahead produces links that lead nowhere. The documents, with their walkthrough videos and PDFs, are at ph-community-sop-ai.vercel.app.",
    keywords: "sop order sequence new client first steps sop-01 sop-02 sop-03 sop-04 videos documents pdf",
    category: "The community",
  },
  {
    title: "What the community words mean",
    body: "Network: the whole Intendrix community. Space: one area inside it - a team space, a lesson area, the welcome area. Plan: the access rule, saying which spaces a person may enter; each client team has its own. Bundle: the plan type used for clients, unlocking a group of spaces at once. Hidden: a plan status meaning it is not advertised and can only be reached by its link. Plan Landing Page: the page that link opens - its address is the invitation link. Bundle token: the code inside that link that actually grants access; confidential. TEAM CONNECT: the sidebar group holding every client's team space. View as: an admin preview showing the community through a chosen member's eyes.",
    keywords: "glossary words meaning network space plan bundle hidden landing page token team connect view as",
    category: "The community",
  },
  {
    title: "Where do I start with a new client?",
    body: "In order: 1. Clients → New client. The wizard asks for the organization, the state they are in, their space and invitation links, and who at Phoenix is responsible. 2. On their client page, add the team - the people who will receive the lessons. 3. New campaign on that client. That wizard asks which programme, which sessions and series, what time the emails leave, who runs it and who the emails come from. 4. Date the sessions. Dating a session is what puts its lesson emails on the calendar. Nothing sends until step 4.",
    keywords: "start begin new client first steps order how do i start onboarding setup",
    category: "Getting started",
  },
  {
    title: "Create a new client, step by step",
    body: "Clients → New client, and answer three screens. The organization: its name, the short name used in lists, sector, city and state. The state is not cosmetic - it decides the timezone their campaigns send in, and without it everything falls back to Eastern. Their space: the space link and the invitation link, both from Mighty Networks; without the invitation link the invitation email has nowhere to send anyone. Who at Phoenix: Leader, Coach and Project Manager. Everything except the name can be left empty, and each screen says in amber what it costs you later.",
    keywords: "new client create wizard organization state space invitation link responsible",
    category: "Getting started",
  },
  {
    title: "Add the client's team",
    body: "Open the client and use the Members table. Each person needs a name, an email address and a role: Participant gets the normal lessons, Leader gets the Leader version with the Leaders Guides, Coach gets a copy of every send. The member list is what decides who receives email - not the small coordinator table on the campaign page. Someone added halfway through a programme can be caught up with 'Send to everyone now' on each lesson they missed; people who already have it are skipped.",
    keywords: "add team members people participants leaders roles client list email addresses",
    category: "Setting up a client",
  },
  {
    title: "Create a campaign, step by step",
    body: "From the client page or Campaigns → New campaign. Four screens. Which programme: a blueprint brings its series with it, or start blank. Sessions and series: the five standard meetings, and which series of lessons to load. What time they go out: the timezone, which starts from the client's state. Who runs it and who it comes from: the Phoenix three, then - separately - the person the emails are actually from, and the client's own champion. The last two are different questions and the app never answers one from the other.",
    keywords: "new campaign create wizard blueprint series sessions timezone sender steps",
    category: "Getting started",
  },
  {
    title: "The three onboarding emails",
    body: "On the campaign's participants card: the user agreement, the community invitation, and the reminder. The agreement asks a person to accept the terms and records the date they do. The invitation sends them the client's invitation link so they can make an account and land in their own team space - it needs the invitation link on the client page to exist. Each person's card shows where they are: not sent, sent and waiting, or done. Nobody is sent the same one twice by accident.",
    keywords: "onboarding invitation agreement welcome reminder invite send buttons participants accepted",
    category: "The community",
  },
  {
    title: "Who is on a campaign",
    body: "The Participants tab on a campaign. A campaign that nobody has been put on reaches the whole client - that way turning this on never silently stops a programme already running. Once anybody is on the list, only that list gets the lessons. 'Update' pulls in people added to the client since. Twenty rows always show, blanks included, so you can see at a glance how full the group is.",
    keywords: "participants who gets campaign list members update rows blank group",
    category: "Setting up a client",
  },
  {
    title: "Check who has joined the community",
    body: "'Check who joined' on the participants card asks Mighty Networks for its member roster and marks everyone whose address matches. It also runs by itself each night. The button turns orange when the nightly check is failing, and hovering it says why. People who joined with a private address instead of the work one you invited will not match - those are reported as 'community members nobody in the app claims', and are worth a minute by hand.",
    keywords: "joined community check mighty networks roster sync nightly matched members",
    category: "The community",
  },
  {
    title: "Duplicate a campaign for the next group",
    body: "The Duplicate button beside a campaign's name. You get the same series, sessions, participants, Phoenix team, sender and tailored wording. Every date is left empty - the session dates and any hand-picked ones - because dates are the one thing a new run never inherits. That also means the copy cannot send anything until you plan it, which is the point.",
    keywords: "duplicate copy campaign again next cohort group repeat clone",
    category: "Day to day",
  },
  {
    title: "An email says Refused - what now?",
    body: "Refused means we tried and the provider turned it back: nobody received it. That is different from Not sent, which means nothing was ever attempted. Open the lesson and it prints the provider's own words, plus the per-person list showing exactly who was refused. Fix what it names, then press 'Send to everyone now' - only people with no successful send on record are tried again, so nothing arrives twice.",
    keywords: "refused failed error bounced not sent provider rejected retry again",
    category: "When something looks wrong",
  },
  {
    title: "My colleague sees a different date than I do",
    body: "Dates are written month first everywhere - 10/07/2026 is the seventh of October - whatever country the browser thinks it is in. Each lesson row also shows the hour and the timezone it sends in, and that is the campaign's zone, not yours: a lesson at 8:00 AM Eastern is 8:00 AM Eastern for everyone looking at it, in Michigan or in Europe. If two people still disagree, they are reading two different rows.",
    keywords: "date different colleague europe america format timezone confusing mm dd yyyy",
    category: "When something looks wrong",
  },
  {
    title: "Why are there no opens or clicks?",
    body: "Opens and clicks are recorded end to end, but they arrive through a tracking subdomain - links.phoenixperform.com - which rewrites every link and serves the invisible open image. While that DNS record is unverified every email stops at 'delivered' however many people read it. The Mailbox says so out loud once enough mail has gone out for the silence to mean something. Nothing in the app needs changing; it starts working by itself when the record resolves.",
    keywords: "opens clicks tracking delivered only not showing links dns cname resend",
    category: "When something looks wrong",
  },
  {
    title: "The team's own page",
    body: "Each campaign can publish one page for that team's space in the community: every lesson they have been sent, newest open, the rest to walk back through. Nothing still to come is shown, so it cannot spoil a lesson or promise one that has not arrived. Create it on the campaign's information tab, copy the embed code, and paste it into their space exactly as it is. 'Take it down' stops the link working everywhere at once.",
    keywords: "team page client facing embed iframe mighty space roadmap journey share link",
    category: "Day to day",
  },
];
