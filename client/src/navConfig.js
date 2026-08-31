// ---------------------------------------------------------------------------
// The single source of truth for primary navigation.
// ---------------------------------------------------------------------------
//
// Both Navbar (the top row / drawer) and BottomNav (the phone tab bar) render
// from this list. It used to live only inside Navbar.jsx; splitting it out
// means the two navs can never drift into disagreeing about what the five
// core destinations are, or what a group's icon and label should be.
//
// Five top-level items, grouped by what someone came here to DO rather than
// by which feature happens to exist:
//
//   Home
//   Check symptoms   -> triage, general triage, health guide
//   Screening        -> anaemia, cycle, pregnancy
//   Find help        -> nearby facilities, helplines
//   My report
//
// Icons carry real weight here, not decoration. A lot of the people this is
// built for read slowly or not at all in the language on screen, and a
// recognisable pictogram next to a label is often what makes a nav usable at
// all. They are paired with text, never used alone.
export const NAV = [
  { to: "/", key: "nav_home", icon: "home" },
  {
    id: "symptoms",
    key: "nav_group_symptoms",
    fallback: "Check symptoms",
    icon: "triage",
    children: [
      { to: "/triage", key: "nav_triage", icon: "triage", blurb: "Tell us what is wrong and how urgent it is" },
      { to: "/general", key: "nav_general", icon: "stethoscope", blurb: "General triage for anyone" },
      { to: "/sakhi", key: "nav_sakhi", icon: "compass", blurb: "Browse trusted health information" },
    ],
  },
  {
    id: "screening",
    key: "nav_group_screening",
    fallback: "Screening",
    icon: "eye",
    children: [
      { to: "/anaemia", key: "nav_anaemia", icon: "eye", blurb: "Do you need a blood test?" },
      { to: "/cycle", key: "nav_cycle", icon: "calendar", blurb: "Track your period, date by date" },
      { to: "/pregnancy", key: "nav_pregnancy", icon: "pregnancy", blurb: "Week, trimester and due date" },
    ],
  },
  {
    id: "help",
    key: "nav_group_help",
    fallback: "Find help",
    icon: "pin",
    children: [
      { to: "/nearby", key: "nav_nearby", icon: "pin", blurb: "Nearest hospital, PHC or sub-centre" },
      { to: "/helplines", key: "nav_helplines", icon: "phone", blurb: "Every national toll-free number" },
    ],
  },
  { to: "/report", key: "nav_report", icon: "report" },
];
