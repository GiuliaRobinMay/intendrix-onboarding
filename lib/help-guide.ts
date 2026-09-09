// The written knowledge behind the "Need help?" assistant: one full guide
// (the assistant's system prompt) and the same material cut into topics
// for the built-in browser, which also answers when no assistant is
// configured. When the app changes, this file is part of the change.

export const APP_GUIDE = `You are the in-app help assistant for Intendrix, the Phoenix Performance team's tool for running lesson-drip email campaigns for their leadership programmes (the Transformational Leadership Experience, TLE). Answer questions about HOW TO USE THIS APP only. Be brief and concrete: short sentences, numbered steps, plain language, no jargon. Answer in the language the user writes in. Never invent features that are not described below. If something is not covered here, say so and suggest asking Giulia (the app's builder) instead of guessing.

HOW THE APP IS ORGANISED
- Clients are organizations. Each client has members (the people who receive lesson emails), a Location (state and city; the state decides which timezone new campaigns start in), Phoenix responsibles (Leader, Coach, Project Manager; the Coach is who emails are sent from), and campaigns.
- A campaign is one run of a programme for one client, created from a blueprint (e.g. TLE for Leaders). It has sessions (live meetings) and series of lessons. Each series is triggered by one session: the session's date starts that series' email schedule.
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
- Phoenix admins see everything and can send. Client admins see only their own organization and cannot send. People are invited from Settings, Team.`;

export interface HelpTopic {
  title: string;
  body: string;
  keywords: string;
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    title: "When do emails go out?",
    body: "Every lesson sends at 8:00 AM in its campaign's timezone (the dropdown on the campaign page). The engine passes twice a day and sends in the first pass after 8:00 local - Eastern campaigns around 8:15 AM Eastern, Pacific around 9:15 AM Pacific. The master switch in Settings must be ON for the engine to send anything.",
    keywords: "time hour when send morning 8am timezone engine schedule",
  },
  {
    title: "Move one email to another date",
    body: "Open the email (in the Mailbox, or via the arrow on the campaign's lesson row) and pick a date on its Date line. Only that email moves - it gets a yellow 'moved by hand' mark, and 'Back to automatic' returns it to the calculated date. Moving a session's date moves all its lessons at once instead.",
    keywords: "date change move reschedule pin individual email later earlier",
  },
  {
    title: "Send an email right now",
    body: "Open the email and press 'Send to everyone now'. A popup shows exactly who will get it before anything leaves. People who already received it are skipped, so pressing it again is harmless - and it is also how you catch up someone who was added later. It works even when the master switch is OFF.",
    keywords: "send now immediately button manual everyone catch up",
  },
  {
    title: "Stop an email from being sent",
    body: "Open the email and press 'Don't send this email'. It stays in the list with the status Cancelled and the engine never sends it for that campaign. 'Restore it' undoes the cancel. To stop a whole campaign, set its status to Paused on the campaign page. To stop everything, switch Email sending OFF in Settings.",
    keywords: "cancel stop don't send skip pause hold block",
  },
  {
    title: "Change an email's text for one campaign",
    body: "Open the email in the Mailbox and click its subject or text to edit. Your wording applies to that campaign only - the master template stays untouched, and the email shows 'Own wording for this campaign' with a 'Reset to master' link. To change the wording for every campaign, edit the master under Settings > Campaigns.",
    keywords: "edit text subject wording copy template master change email",
  },
  {
    title: "What the statuses mean",
    body: "Scheduled: on the calendar, will send on its date. Sent (green): really delivered - it comes from the send log, never just the calendar. Not sent (orange): the date passed but nothing went out. Cancelled: never sends for this campaign. Awaiting date: the trigger session has no date yet.",
    keywords: "status not sent cancelled scheduled awaiting green orange meaning why says shows",
  },
  {
    title: "Did someone get their email?",
    body: "Per email: open it and look at the Delivery panel - sent, delivered, opened, clicked, bounced, and 'Who?' lists every person. Per person: on the client page, open the info button on their member row to see every email they received. Opens undercount because many mail programs block the tracking image - clicks are the reliable signal. Bounced (red) means the address is bad: fix it on the member and use 'Send to everyone now' to resend to just them.",
    keywords: "delivered opened clicked bounced received check person individual delivery report",
  },
  {
    title: "Test an email on yourself",
    body: "Open the email and press 'Send me a test'. It goes only to your own inbox, marked TEST in the subject with a banner, so it can never be mistaken for the real thing. Members never see test sends.",
    keywords: "test preview try myself inbox check before",
  },
  {
    title: "Add people to a client",
    body: "On the client page, use the + next to Members, or ask Giulia to import a list. Each person has a role: Participant gets the normal emails, Leader gets the Leader version with the Leaders Guides, Coach gets a copy of every send. Everyone in the member list receives the client's campaign emails - the small team table on the campaign page is only for coordinators.",
    keywords: "add member people import participant leader role team",
  },
  {
    title: "Who emails are sent from",
    body: "The campaign's Phoenix Coach (set on the client or campaign page). A campaign can instead nominate one of the client's own people in 'Emails sent by' - recipients see that person's name and replies reach them, while the address stays on the sending domain. Signatures and the company logo live under Settings > Team.",
    keywords: "sender from coach champion reply signature logo who sends",
  },
  {
    title: "Copies for people watching a campaign",
    body: "On the campaign page, the field 'Send a copy of everything to' takes comma-separated addresses. Each gets one copy of every lesson as it goes out - without being a member, without personalisation, marked with the client's name in the subject. Remove an address from the field to stop the copies.",
    keywords: "copy watcher cc shadow monitor coordinator receive everything",
  },
  {
    title: "The master switch",
    body: "Settings > Email sending. OFF means the daily engine never sends anything, no matter what is due. ON means everything scheduled goes out automatically on its date. The 'Send to everyone now' button works in both positions, because it sends only what you explicitly confirm. An email more than 2 days overdue is never auto-sent even when ON - it is held, to prevent backlog floods.",
    keywords: "switch on off master engine automatic sending enable disable",
  },
  {
    title: "Deleting things safely",
    body: "Everything deletable has a trashcan with an 'are you sure' popup naming what goes. A client whose campaigns have really sent emails cannot be deleted at all (faded bin) - archive it instead via the status dropdown on its page. Removing a member stops their future emails; what they already received stays in the log.",
    keywords: "delete remove trash bin faded archive cannot protect",
  },
  {
    title: "Timezones and locations",
    body: "Each client has a Location card (state + city). The state decides which timezone NEW campaigns start with, so emails land at 8:00 AM in the client's own morning. An existing campaign's timezone is its own dropdown on the campaign page. Without a state, new campaigns fall back to Eastern.",
    keywords: "timezone state city location pacific eastern hour zone",
  },
];
