// Mock data for the mockup phase — replaced by Supabase in phase 2.
// Series content transcribed from Brad's document
// "The New Transformational Leadership Experience for Executives" (7/31/26).
// Member names (except roles/structure) are SAMPLE DATA.

import type {
  CampaignTemplate,
  Client,
  SeriesTemplate,
  StaffMember,
} from "./types";

const P = "https://intendrix.ai/posts/";

const L = {
  newMemberGuide: {
    label: "New Member Guide",
    url: "https://intendrix.ai/spaces/22388417/content",
  },
  personalMastery: {
    label: "Personal Mastery",
    url: `${P}start-your-journey-%E2%9E%BD-start-living-by-design-not-default`,
  },
  growthMindset: {
    label: "Growth Mindset",
    url: `${P}design-your-life-%E2%9E%BD-prove-to-yourself-that-you-are-not-fixed`,
  },
  coachingRelationships: {
    label: "Coaching Relationships",
    url: `${P}career-aspirations-%E2%9E%BD-grow-through-coaching-partnerships-at-work`,
  },
  kiteGraph: {
    label: "Decode Your Kite Graph",
    url: `${P}know-yourself-%E2%9E%BD-decode-your-kite-graph-and-read-yourself-clearly`,
  },
  habits: {
    label: "Master the Small Daily Habits",
    url: `${P}start-your-journey-%E2%9E%BD-master-the-small-daily-habits-to-reshape-your-life`,
  },
  beingInspirational: {
    label: "Speak a Vivid Future Into Being",
    url: `${P}be-your-purpose-%E2%9E%BD-speak-a-vivid-future-into-being`,
  },
  leadersGuide02: {
    label: "Leaders Guide 02 — Discussion Guide for Any Lesson",
    url: `${P}basecamp-for-leaders-a-discussion-guide-for-leading-any-and-all-lessons`,
  },
  leadersGuide04: {
    label: "Leaders Guide 04 — Your Guide to All the Lessons",
    url: `${P}basecamp-for-leaders-leaders-guide-your-guide-to-all-the-lessons`,
  },
  careerAspirations: {
    label: "Anchor Your Career in What Truly Drives You",
    url: `${P}career-aspirations-%E2%9E%BD-anchor-your-career-in-what-truly-drives-you`,
  },
  leadersGuide03: {
    label: "Leaders Guide 03 — Discussions in Action (two-video set)",
    url: `${P}basecamp-for-leaders-discussions-in-action-a-two-video-set-of-lesson`,
  },
  missionYourOwn: {
    label: "Make Your Organization's Mission Your Own",
    url: `${P}career-aspirations-%E2%9E%BD-make-your-organizations-mission-your-own`,
  },
  lgMissionMine: {
    label: "Leaders Guide — The Mission is Mine",
    url: `${P}basecamp-for-leaders-leaders-guide-lesson-s5-m2-the-mission-is-mine`,
  },
  deptPurpose: {
    label: "Define the Contribution Your Team Is Here to Make",
    url: `${P}career-aspirations-%E2%9E%BD-define-the-contribution-your-team-is-here-to-make`,
  },
  lgPurposeOfJob: {
    label: "Leaders Guide — Purpose of My Job (S5 M4)",
    url: `${P}basecamp-for-leaders-leaders-guide-lesson-s5-m4-purpose-of-my-job`,
  },
  beingYourWord: {
    label: "Become Someone Whose Word Can Be Counted On",
    url: `${P}be-your-purpose-%E2%9E%BD-become-someone-whose-word-can-be-counted-on`,
  },
  guardianOfTime: {
    label: "Being the Guardian of Your Time",
    url: `${P}be-your-purpose-%E2%9E%BD-being-the-guardian-of-your-time`,
  },
  supportiveAccountability: {
    label: "Turn Accountability Into Support That Drives Results",
    url: `${P}career-aspirations-%E2%9E%BD-turn-accountability-into-support-that-drives-results`,
  },
  lgSupportiveAccountability: {
    label: "Leaders Guide — Supportive Accountability (S5 M6)",
    url: `${P}basecamp-for-leaders-leaders-guide-lesson-s5-m6-supportive-accountability`,
  },
  measuringEffectiveness: {
    label: "Track the Impact You're Actually Making",
    url: `${P}career-aspirations-%E2%9E%BD-track-the-impact-youre-actually-making`,
  },
  lgMeasuringEffectiveness: {
    label: "Leaders Guide — Measuring Your Effectiveness (S5 M5)",
    url: `${P}basecamp-for-leaders-leaders-guide-lesson-s5-m5-measuring-your-effectiveness`,
  },
  lgUnderstandingGraph: {
    label: "Leaders Guide — Understanding Your Graph (S2 M9)",
    url: `${P}basecamp-for-leaders-leaders-guide-lesson-s2-m9-understanding-your-graph`,
  },
  beingNurturing: {
    label: "Coach Others Into the Potential They Can't Yet See",
    url: `${P}be-your-purpose-%E2%9E%BD-coach-others-into-the-potential-they-cant-yet-see`,
  },
  beingAttentive: {
    label: "Hold Your Full Presence in Every Conversation",
    url: `${P}be-your-purpose-%E2%9E%BD-hold-your-full-presence-in-every-conversation`,
  },
  lgCoachingRelationships: {
    label: "Leaders Guide — Developing Coaching Relationships (S5 M7)",
    url: `${P}basecamp-for-leaders-leaders-guide-lesson-s5-m7-developing-coaching-relationships`,
  },
  integratedLife: {
    label: "Integrate Every Area of Your Life Into One Whole",
    url: `${P}design-your-life-%E2%9E%BD-integrate-every-area-of-your-life-into-one-whole`,
  },
  integratedLifeDesign: {
    label: "Designing Your Integrated Life",
    url: `${P}design-your-life-%E2%9E%BD-designing-your-integrated-life`,
  },
} as const;

// ——— Campaign blueprints (Settings → Campaigns) ——————————————

export const campaignTemplates: CampaignTemplate[] = [
  {
    id: "tle-e",
    code: "TLE-E",
    name: "TLE for Executives",
    description:
      "The Transformational Leadership Experience for an executive team: five sessions over 26 weeks, each followed by its own series of Intendrix lessons.",
  },
  {
    id: "tle-l",
    code: "TLE-L",
    name: "TLE for Leaders",
    description:
      "The Transformational Leadership Experience for leaders — duplicated from TLE for Executives; one extra series is expected to be inserted.",
  },
  {
    id: "tle-ic",
    code: "TLE-IC",
    name: "TLE for Individual Contributors",
    description:
      "The Transformational Leadership Experience for individual contributors — two series; content and timing to be loaded from Brad's document.",
  },
];

/** TLE-L starts as an exact duplicate of the TLE-E series (Brad, 2026-08-14);
 *  built below by cloning with distinct ids. */

export const seriesTemplates: SeriesTemplate[] = [
  {
    id: "poea",
    campaignTemplateId: "tle-e",
    code: "POEA",
    name: "Post-Orientation",
    focus: "Getting started & personal mastery",
    trigger: "orientation",
    triggerLabel: "Orientation Session",
    color: "#eb320f",
    steps: [
      {
        id: "poea-1",
        code: "POEA 1.2",
        title: "Welcome & Getting Started",
        offsetDays: 1,
        sendTime: "08:00",
        participant: {
          emailSubject: "Welcome to Intendrix — your journey starts now",
          emailBody:
            "Welcome aboard! In this short video Amber walks you through the logistics: how the lessons arrive, the survey process, and your first homework — go to the New Member Guide in Intendrix and complete your profile.",
          lesson: L.newMemberGuide,
          note: "Video pending: Amber re-records the original welcome (no Tom & Brad mention, new survey process, new homework assignment).",
        },
        leader: {
          emailSubject: "Welcome to Intendrix — your journey starts now",
          emailBody:
            "Welcome aboard! In this short video Amber walks you through the logistics: how the lessons arrive, the survey process, and your first homework — go to the New Member Guide in Intendrix and complete your profile.",
          lesson: L.newMemberGuide,
          note: "Video pending: Amber re-records the original welcome (no Tom & Brad mention, new survey process, new homework assignment).",
        },
      },
      {
        id: "poea-2",
        code: "POEA 1.4",
        title: "Personal Mastery",
        offsetDays: 2,
        sendTime: "08:00",
        participant: {
          emailSubject: "Start living by design, not default",
          emailBody:
            "Your first lesson is here. Personal Mastery is the foundation everything else builds on — take 15 minutes this week to go through it.",
          lesson: L.personalMastery,
        },
        leader: {
          emailSubject: "Start living by design, not default",
          emailBody:
            "Your first lesson is here. Personal Mastery is the foundation everything else builds on — take 15 minutes this week to go through it.",
          lesson: L.personalMastery,
        },
      },
      {
        id: "poea-3",
        code: "POEA 1.6",
        title: "Growth Mindset",
        offsetDays: 7,
        sendTime: "08:00",
        participant: {
          emailSubject: "Prove to yourself that you are not fixed",
          emailBody:
            "This week's lesson: Growth Mindset. Discover how much of what feels fixed about you is actually up for design.",
          lesson: L.growthMindset,
        },
        leader: {
          emailSubject: "Prove to yourself that you are not fixed",
          emailBody:
            "This week's lesson: Growth Mindset. Discover how much of what feels fixed about you is actually up for design.",
          lesson: L.growthMindset,
        },
      },
      {
        id: "poea-4",
        code: "POEA 1.7",
        title: "Coaching Relationships",
        offsetDays: 7,
        sendTime: "08:00",
        participant: {
          emailSubject: "Grow through coaching partnerships at work",
          emailBody:
            "This week's lesson looks at the coaching relationships that accelerate growth — yours and your colleagues'.",
          lesson: L.coachingRelationships,
        },
        leader: {
          emailSubject: "Grow through coaching partnerships at work",
          emailBody:
            "This week's lesson looks at the coaching relationships that accelerate growth — yours and your colleagues'.",
          lesson: L.coachingRelationships,
        },
      },
      {
        id: "poea-5",
        code: "POEA 1.8",
        title: "Comfort Zone",
        offsetDays: 7,
        sendTime: "08:00",
        participant: {
          emailSubject: "Decode your Kite Graph and read yourself clearly",
          emailBody:
            "Before the workshop: learn to read your own Kite Graph and see where your comfort zone has been drawing its borders.",
          lesson: L.kiteGraph,
        },
        leader: {
          emailSubject: "Decode your Kite Graph and read yourself clearly",
          emailBody:
            "Before the workshop: learn to read your own Kite Graph and see where your comfort zone has been drawing its borders.",
          lesson: L.kiteGraph,
        },
      },
    ],
  },
  {
    id: "pwea",
    campaignTemplateId: "tle-e",
    code: "PWEA",
    name: "Post-Workshop",
    focus: "Leadership",
    trigger: "workshop",
    triggerLabel: "Workshop",
    color: "#cf3352",
    steps: [
      {
        id: "pwea-1",
        code: "PWEA 1",
        title: "Habits",
        offsetDays: 7,
        sendTime: "08:00",
        participant: {
          emailSubject: "Master the small daily habits that reshape your life",
          emailBody:
            "The workshop was the spark — habits are what keep it burning. This week's lesson shows how small daily habits reshape your leadership.",
          lesson: L.habits,
        },
        leader: {
          emailSubject: "Master the small daily habits that reshape your life",
          emailBody:
            "The workshop was the spark — habits are what keep it burning. This week's lesson shows how small daily habits reshape your leadership.",
          lesson: L.habits,
        },
      },
      {
        id: "pwea-2",
        code: "PWEA 2",
        title: "Being Inspirational",
        offsetDays: 7,
        sendTime: "08:00",
        participant: {
          emailSubject: "Speak a vivid future into being",
          emailBody:
            "This week: leading from inspiration rather than fear. What future could you describe to your team that would be worth working toward?",
          lesson: L.beingInspirational,
        },
        leader: {
          emailSubject: "Speak a vivid future into being — plus your Leaders Guides",
          emailBody:
            "This week: leading from inspiration rather than fear. We suggest you hold a team meeting with your participants in 2 weeks to discuss this lesson and the next two. To prepare, we've included your Leaders Guides — your coaching in facilitating discussions that promote personal growth.",
          lesson: L.beingInspirational,
          extras: [L.leadersGuide02, L.leadersGuide04],
          note: "First send that introduces the Leaders Guide series to the CEO.",
        },
      },
      {
        id: "pwea-3",
        code: "PWEA 3",
        title: "Your Career Aspirations",
        offsetDays: 7,
        sendTime: "08:00",
        participant: {
          emailSubject: "Anchor your career in what truly drives you",
          emailBody:
            "This week's lesson: what actually drives your career — beneath the job title.",
          lesson: L.careerAspirations,
        },
        leader: {
          emailSubject: "Anchor your career in what truly drives you",
          emailBody:
            "This week's lesson: what actually drives your career — beneath the job title. Your Leaders Guide for this conversation is included.",
          lesson: L.careerAspirations,
          extras: [L.leadersGuide03],
        },
      },
      {
        id: "pwea-4",
        code: "PWEA 4",
        title: "Leading Your Life at Work",
        offsetDays: 7,
        sendTime: "08:00",
        participant: {
          emailSubject: "Make your organization's mission your own",
          emailBody:
            "This week's lesson connects your personal purpose with the organization's mission — where the two meet is where leadership gets real.",
          lesson: L.missionYourOwn,
        },
        leader: {
          emailSubject: "Make your organization's mission your own — team meeting week",
          emailBody:
            "This week's lesson connects personal purpose with the organization's mission. Have your team meeting this week — before leading it, see the Leaders Guide 'The Mission is Mine'.",
          lesson: L.missionYourOwn,
          extras: [L.lgMissionMine],
          teamMeeting:
            "Discuss Habits, Being Inspirational, Career Aspirations and The Mission is Mine.",
        },
      },
      {
        id: "pwea-5",
        code: "PWEA 5",
        title: "Department Purpose",
        offsetDays: 7,
        sendTime: "08:00",
        participant: {
          emailSubject: "Define the contribution your team is here to make",
          emailBody:
            "This week's lesson: your department's purpose — the contribution your team is here to make.",
          lesson: L.deptPurpose,
        },
        leader: {
          emailSubject: "Define the contribution your team is here to make",
          emailBody:
            "This week's lesson: your department's purpose. Before leading this conversation with your team, see the Leaders Guide 'Purpose of My Job'. Give the team 2 weeks to work on this.",
          lesson: L.deptPurpose,
          extras: [L.lgPurposeOfJob],
          teamMeeting:
            "Work session on Department Purpose — give participants 2 weeks to work on it.",
        },
      },
    ],
  },
  {
    id: "pcs1",
    campaignTemplateId: "tle-e",
    code: "PCS1",
    name: "Post-Coaching Session 1",
    focus: "Management",
    trigger: "coaching1",
    triggerLabel: "Coaching Session 1",
    color: "#a1348c",
    steps: [
      {
        id: "pcs1-1",
        code: "PCS1 1",
        title: "Being Your Word",
        offsetDays: 2,
        sendTime: "08:00",
        participant: {
          emailSubject: "Become someone whose word can be counted on",
          emailBody:
            "Management starts with integrity. This week's lesson: being your word.",
          lesson: L.beingYourWord,
        },
        leader: {
          emailSubject: "Become someone whose word can be counted on",
          emailBody:
            "Management starts with integrity. This week's lesson: being your word.",
          lesson: L.beingYourWord,
        },
      },
      {
        id: "pcs1-2",
        code: "PCS1 5.5",
        title: "Being the Guardian of Your Time",
        offsetDays: 7,
        sendTime: "08:00",
        participant: {
          emailSubject: "Being the guardian of your time",
          emailBody:
            "This week's lesson (S4 M5.5): guarding your time like the strategic asset it is.",
          lesson: L.guardianOfTime,
        },
        leader: {
          emailSubject: "Being the guardian of your time",
          emailBody:
            "This week's lesson (S4 M5.5): guarding your time like the strategic asset it is.",
          lesson: L.guardianOfTime,
        },
      },
      {
        id: "pcs1-3",
        code: "PCS1 2",
        title: "Supportive Accountability",
        offsetDays: 7,
        sendTime: "08:00",
        participant: {
          emailSubject: "Turn accountability into support that drives results",
          emailBody:
            "This week's lesson: accountability that supports people instead of policing them.",
          lesson: L.supportiveAccountability,
        },
        leader: {
          emailSubject: "Turn accountability into support that drives results",
          emailBody:
            "This week's lesson: accountability that supports people instead of policing them. Your Leaders Guide for this conversation is included.",
          lesson: L.supportiveAccountability,
          extras: [L.lgSupportiveAccountability],
        },
      },
      {
        id: "pcs1-4",
        code: "PCS1 3",
        title: "Measuring Your Effectiveness",
        offsetDays: 7,
        sendTime: "08:00",
        participant: {
          emailSubject: "Track the impact you're actually making",
          emailBody:
            "This week's lesson: measuring your effectiveness — tracking the impact you're actually making, not just the activity.",
          lesson: L.measuringEffectiveness,
        },
        leader: {
          emailSubject: "Track the impact you're actually making — team meeting week",
          emailBody:
            "This week's lesson: measuring your effectiveness. Before leading this conversation, see the Leaders Guide. Then hold your team meeting.",
          lesson: L.measuringEffectiveness,
          extras: [L.lgMeasuringEffectiveness],
          teamMeeting:
            "Discuss Supportive Accountability and Measuring Your Effectiveness. Work with participants to develop and agree on measures for their department or unit — 3 weeks to work on this.",
        },
      },
    ],
  },
  {
    id: "pcs2",
    campaignTemplateId: "tle-e",
    code: "PCS2",
    name: "Post-Coaching Session 2",
    focus: "Coaching",
    trigger: "coaching2",
    triggerLabel: "Coaching Session 2",
    color: "#6531a5",
    steps: [
      {
        id: "pcs2-1",
        code: "PCS2 1",
        title: "Understanding Your Graph",
        offsetDays: 2,
        sendTime: "08:00",
        participant: {
          emailSubject: "Decode your Kite Graph and read yourself clearly",
          emailBody:
            "The coaching series opens with self-knowledge: decode your Kite Graph and read yourself clearly. In 3 weeks, your leader will host a team meeting on the next three lessons.",
          lesson: L.kiteGraph,
        },
        leader: {
          emailSubject: "Decode your Kite Graph — plus your Leaders Guide",
          emailBody:
            "The coaching series opens with self-knowledge. In 3 weeks we suggest you hold a team meeting to discuss the next 3 lessons. Your Leaders Guide 'Understanding Your Graph' is included.",
          lesson: L.kiteGraph,
          extras: [L.lgUnderstandingGraph],
        },
      },
      {
        id: "pcs2-2",
        code: "PCS2 2",
        title: "Being Nurturing",
        offsetDays: 7,
        sendTime: "08:00",
        participant: {
          emailSubject: "Coach others into the potential they can't yet see",
          emailBody:
            "This week's lesson: nurturing — coaching people into the potential they can't yet see in themselves.",
          lesson: L.beingNurturing,
        },
        leader: {
          emailSubject: "Coach others into the potential they can't yet see",
          emailBody:
            "This week's lesson: nurturing — coaching people into the potential they can't yet see in themselves.",
          lesson: L.beingNurturing,
        },
      },
      {
        id: "pcs2-3",
        code: "PCS2 3",
        title: "Being Attentive",
        offsetDays: 7,
        sendTime: "08:00",
        participant: {
          emailSubject: "Hold your full presence in every conversation",
          emailBody:
            "This week's lesson: attentiveness — holding your full presence in every conversation.",
          lesson: L.beingAttentive,
        },
        leader: {
          emailSubject: "Hold your full presence in every conversation",
          emailBody:
            "This week's lesson: attentiveness — holding your full presence in every conversation.",
          lesson: L.beingAttentive,
        },
      },
      {
        id: "pcs2-4",
        code: "PCS2 4",
        title: "Coaching Relationships",
        offsetDays: 7,
        sendTime: "08:00",
        participant: {
          emailSubject: "Grow through coaching partnerships at work",
          emailBody:
            "This week's lesson: building coaching relationships across your team.",
          lesson: L.coachingRelationships,
        },
        leader: {
          emailSubject: "Grow through coaching partnerships — team meeting week",
          emailBody:
            "This week's lesson: building coaching relationships. Before leading this with your people, see the Leaders Guide 'Developing Coaching Relationships'. Then hold your team meeting.",
          lesson: L.coachingRelationships,
          extras: [L.lgCoachingRelationships],
          teamMeeting:
            "Discuss lessons 2–4 and progress on participants coaching their team members. Give participants 3 weeks to complete coaching with their team.",
        },
      },
      {
        id: "pcs2-5",
        code: "PCS2 5",
        title: "Being Impactful",
        offsetDays: 7,
        sendTime: "08:00",
        participant: {
          emailSubject: "Being impactful",
          emailBody:
            "This week's lesson (S4 M6.5): being impactful.",
          lesson: { label: "Being Impactful (S4 M6.5)", url: null },
          note: "Lesson link missing in the source document — to be added.",
        },
        leader: {
          emailSubject: "Being impactful",
          emailBody:
            "This week's lesson (S4 M6.5): being impactful.",
          lesson: { label: "Being Impactful (S4 M6.5)", url: null },
          note: "Lesson link missing in the source document — to be added.",
        },
      },
    ],
  },
  {
    id: "pls",
    campaignTemplateId: "tle-e",
    code: "PLS",
    name: "Post-Launch",
    focus: "Integrated life & lasting habits",
    trigger: "launch",
    triggerLabel: "Launch Session",
    color: "#2c2d83",
    steps: [
      {
        id: "pls-1",
        code: "PLS 1",
        title: "Integrated Life",
        offsetDays: 7,
        sendTime: "08:00",
        participant: {
          emailSubject: "Integrate every area of your life into one whole",
          emailBody:
            "The program is launched — now for life beyond it. This week's lesson: the integrated life.",
          lesson: L.integratedLife,
        },
        leader: {
          emailSubject: "Integrate every area of your life into one whole",
          emailBody:
            "The program is launched — now for life beyond it. This week's lesson: the integrated life.",
          lesson: L.integratedLife,
        },
      },
      {
        id: "pls-2",
        code: "PLS 2",
        title: "Integrated Life Design",
        offsetDays: 7,
        sendTime: "08:00",
        participant: {
          emailSubject: "Designing your integrated life",
          emailBody:
            "This week's lesson: designing your integrated life — turning the vision into a design you live by.",
          lesson: L.integratedLifeDesign,
        },
        leader: {
          emailSubject: "Designing your integrated life",
          emailBody:
            "This week's lesson: designing your integrated life — turning the vision into a design you live by.",
          lesson: L.integratedLifeDesign,
        },
      },
      {
        id: "pls-3",
        code: "PLS 3",
        title: "Your Habits",
        offsetDays: 7,
        sendTime: "08:00",
        participant: {
          emailSubject: "The choice is yours",
          emailBody:
            "The habits you create from this six-month experience will determine whether this work makes lasting value that continues to change your culture — or becomes a wonderful experience you look back on fondly, but that makes little difference. The choice is yours.",
          lesson: L.habits,
          note: "May become an email-only send or a closing video — to decide.",
        },
        leader: {
          emailSubject: "The choice is yours",
          emailBody:
            "The habits you create from this six-month experience will determine whether this work makes lasting value that continues to change your culture — or becomes a wonderful experience you look back on fondly, but that makes little difference. The choice is yours.",
          lesson: L.habits,
          note: "May become an email-only send or a closing video — to decide.",
        },
      },
    ],
  },
];

// duplicate every TLE-E series into the TLE-L blueprint with fresh ids
const tleLSeries: SeriesTemplate[] = seriesTemplates
  .filter((t) => t.campaignTemplateId === "tle-e")
  .map((t) => ({
    ...t,
    id: `l-${t.id}`,
    campaignTemplateId: "tle-l",
    steps: t.steps.map((step) => ({
      ...step,
      id: `l-${step.id}`,
      participant: { ...step.participant },
      leader: { ...step.leader },
    })),
  }));
seriesTemplates.push(...tleLSeries);

// ——— Clients ———————————————————————————————————————————————

const careSouthMembers = [
  { name: "Ann Lewis", title: "CEO", role: "leader" },
  { name: "Joy Gandy", title: "Director of Nursing" },
  { name: "Marcus Reed", title: "COO" },
  { name: "Dana Whitfield", title: "CFO" },
  { name: "Sam Okafor", title: "CMO" },
  { name: "Rachel Nguyen", title: "VP Human Resources" },
  { name: "Tom Delaney", title: "VP Operations" },
  { name: "Keisha Brown", title: "Director of Quality" },
  { name: "Luis Herrera", title: "Director of Pharmacy" },
  { name: "Emily Sanders", title: "Director of Behavioral Health" },
  { name: "Grant Mitchell", title: "Director of IT" },
  { name: "Priya Patel", title: "Medical Director" },
  { name: "Carla Jenkins", title: "Director of Dental Services" },
  { name: "Steve Aldridge", title: "Facilities Director" },
  { name: "Monique Davis", title: "Director of Outreach" },
  { name: "Hannah Kim", title: "Compliance Officer" },
  { name: "Derek Foster", title: "Director of Finance" },
  { name: "Alicia Gomez", title: "Patient Services Director" },
  { name: "Bill Turner", title: "Development Director" },
].map((m, i) => ({
  id: `cs-m${i + 1}`,
  name: m.name,
  title: m.title,
  email: `${m.name.toLowerCase().replace(/[^a-z]+/g, ".")}@caresouth.example`,
  role: (m.role ?? "participant") as "leader" | "participant",
}));

export const clients: Client[] = [
  {
    id: "caresouth",
    name: "CareSouth Carolina",
    shortName: "CareSouth",
    location: "South Carolina, USA",
    sector: "Community healthcare",
    status: "active",
    phoenixLeaderId: "brad",
    phoenixCoachId: "amber",
    projectManagerId: "amber",
    spaceUrl: "",
    inviteUrl: "",
    members: careSouthMembers,
    campaigns: [
      {
        id: "caresouth-tle-e",
        code: "TLE-E",
        name: "TLE for Executives",
        timezone: "America/New_York",
        templateId: "tle-e",
        startDate: "2026-08-05",
        endDate: "2027-02-03",
        phoenixTeam: [],
        clientTeam: [{ id: "cs-ca-1", memberId: "cs-m1", role: "champion" }],
        sessions: [
          { id: "cs-s1", kind: "orientation", name: "Orientation Session", date: "2026-08-05", mode: "virtual" },
          { id: "cs-s2", kind: "workshop", name: "Workshop", date: "2026-09-16", mode: "in-person" },
          { id: "cs-s3", kind: "coaching1", name: "Coaching Session 1 · Management", date: null, mode: "virtual" },
          { id: "cs-s4", kind: "coaching2", name: "Coaching Session 2 · Coaching", date: null, mode: "in-person" },
          { id: "cs-s5", kind: "launch", name: "Launch Session", date: null, mode: "virtual" },
        ],
        series: [
          { templateId: "poea", sessionId: "cs-s1" },
          { templateId: "pwea", sessionId: "cs-s2" },
          { templateId: "pcs1", sessionId: "cs-s3" },
          { templateId: "pcs2", sessionId: "cs-s4" },
          { templateId: "pls", sessionId: "cs-s5" },
        ],
      },
    ],
  },
  {
    id: "brio",
    name: "Brio Living Services",
    shortName: "Brio",
    location: "Michigan, USA",
    sector: "Senior living services",
    status: "active",
    phoenixLeaderId: "brad",
    phoenixCoachId: "amber",
    members: [],
    campaigns: [
      {
        id: "brio-tle-e",
        code: "TLE-E",
        name: "TLE for Executives",
        timezone: "America/New_York",
        templateId: "tle-e",
        phoenixTeam: [],
        clientTeam: [],
        sessions: [
          { id: "br-s1", kind: "orientation", name: "Orientation Session", date: null, mode: "virtual" },
          { id: "br-s2", kind: "workshop", name: "Workshop", date: null, mode: "in-person" },
          { id: "br-s3", kind: "coaching1", name: "Coaching Session 1 · Management", date: null, mode: "virtual" },
          { id: "br-s4", kind: "coaching2", name: "Coaching Session 2 · Coaching", date: null, mode: "in-person" },
          { id: "br-s5", kind: "launch", name: "Launch Session", date: null, mode: "virtual" },
        ],
        series: [
          { templateId: "poea", sessionId: "br-s1" },
          { templateId: "pwea", sessionId: "br-s2" },
          { templateId: "pcs1", sessionId: "br-s3" },
          { templateId: "pcs2", sessionId: "br-s4" },
          { templateId: "pls", sessionId: "br-s5" },
        ],
      },
    ],
  },
  {
    id: "merit",
    name: "Merit",
    shortName: "Merit",
    location: "USA",
    sector: "—",
    status: "active",
    phoenixLeaderId: "kevin",
    phoenixCoachId: "amber",
    members: [],
    campaigns: [
      {
        id: "merit-tle-e",
        code: "TLE-E",
        name: "TLE for Executives",
        timezone: "America/New_York",
        templateId: "tle-e",
        phoenixTeam: [],
        clientTeam: [],
        sessions: [
          { id: "me-s1", kind: "orientation", name: "Orientation Session", date: null, mode: "virtual" },
          { id: "me-s2", kind: "workshop", name: "Workshop", date: null, mode: "in-person" },
          { id: "me-s3", kind: "coaching1", name: "Coaching Session 1 · Management", date: null, mode: "virtual" },
          { id: "me-s4", kind: "coaching2", name: "Coaching Session 2 · Coaching", date: null, mode: "in-person" },
          { id: "me-s5", kind: "launch", name: "Launch Session", date: null, mode: "virtual" },
        ],
        series: [
          { templateId: "poea", sessionId: "me-s1" },
          { templateId: "pwea", sessionId: "me-s2" },
          { templateId: "pcs1", sessionId: "me-s3" },
          { templateId: "pcs2", sessionId: "me-s4" },
          { templateId: "pls", sessionId: "me-s5" },
        ],
      },
    ],
  },
  {
    id: "tlc-academy",
    name: "The Learning Choice Academy",
    shortName: "TLC Academy",
    location: "California, USA",
    sector: "Education",
    status: "active",
    phoenixLeaderId: "brad",
    phoenixCoachId: "giulia",
    members: [],
    campaigns: [
      {
        id: "tlc-tle-e",
        code: "TLE-E",
        name: "TLE for Executives",
        timezone: "America/Los_Angeles",
        templateId: "tle-e",
        phoenixTeam: [],
        clientTeam: [],
        sessions: [
          { id: "tl-s1", kind: "orientation", name: "Orientation Session", date: null, mode: "virtual" },
          { id: "tl-s2", kind: "workshop", name: "Workshop", date: null, mode: "in-person" },
          { id: "tl-s3", kind: "coaching1", name: "Coaching Session 1 · Management", date: null, mode: "virtual" },
          { id: "tl-s4", kind: "coaching2", name: "Coaching Session 2 · Coaching", date: null, mode: "in-person" },
          { id: "tl-s5", kind: "launch", name: "Launch Session", date: null, mode: "virtual" },
        ],
        series: [
          { templateId: "poea", sessionId: "tl-s1" },
          { templateId: "pwea", sessionId: "tl-s2" },
          { templateId: "pcs1", sessionId: "tl-s3" },
          { templateId: "pcs2", sessionId: "tl-s4" },
          { templateId: "pls", sessionId: "tl-s5" },
        ],
      },
    ],
  },
  {
    id: "zumbro",
    name: "Zumbro Valley",
    shortName: "Zumbro",
    location: "Minnesota, USA",
    sector: "Community health",
    status: "active",
    phoenixLeaderId: "kevin",
    phoenixCoachId: "giulia",
    members: [],
    campaigns: [
      {
        id: "zumbro-tle-e",
        code: "TLE-E",
        name: "TLE for Executives",
        timezone: "America/Chicago",
        templateId: "tle-e",
        phoenixTeam: [],
        clientTeam: [],
        sessions: [
          { id: "zv-s1", kind: "orientation", name: "Orientation Session", date: null, mode: "virtual" },
          { id: "zv-s2", kind: "workshop", name: "Workshop", date: null, mode: "in-person" },
          { id: "zv-s3", kind: "coaching1", name: "Coaching Session 1 · Management", date: null, mode: "virtual" },
          { id: "zv-s4", kind: "coaching2", name: "Coaching Session 2 · Coaching", date: null, mode: "in-person" },
          { id: "zv-s5", kind: "launch", name: "Launch Session", date: null, mode: "virtual" },
        ],
        series: [
          { templateId: "poea", sessionId: "zv-s1" },
          { templateId: "pwea", sessionId: "zv-s2" },
          { templateId: "pcs1", sessionId: "zv-s3" },
          { templateId: "pcs2", sessionId: "zv-s4" },
          { templateId: "pls", sessionId: "zv-s5" },
        ],
      },
    ],
  },
];

export const team: StaffMember[] = [
  { id: "brad", name: "Brad Zimmerman", role: "Phoenix Coach · Owner", initials: "BZ", email: "brad@intendrix.ai" },
  { id: "kevin", name: "Kevin", role: "Phoenix Coach", initials: "KV", email: "kevin@intendrix.ai" },
  { id: "amber", name: "Amber", role: "Program Coordinator", initials: "AM", email: "amber@intendrix.ai" },
  { id: "giulia", name: "Giulia May", role: "Community & Platform", initials: "GM", email: "giulia@intendrix.ai" },
];
