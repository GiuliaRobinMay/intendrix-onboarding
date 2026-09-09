// The US states, each with the IANA timezone most of the state lives in.
// Picking a client's state is what lets new campaigns default to the
// client's own morning instead of Eastern time.

export interface UsState {
  code: string;
  name: string;
  tz: string;
}

const E = "America/New_York";
const C = "America/Chicago";
const M = "America/Denver";
const P = "America/Los_Angeles";

export const US_STATES: UsState[] = [
  { code: "AL", name: "Alabama", tz: C },
  { code: "AK", name: "Alaska", tz: "America/Anchorage" },
  { code: "AZ", name: "Arizona", tz: "America/Phoenix" },
  { code: "AR", name: "Arkansas", tz: C },
  { code: "CA", name: "California", tz: P },
  { code: "CO", name: "Colorado", tz: M },
  { code: "CT", name: "Connecticut", tz: E },
  { code: "DE", name: "Delaware", tz: E },
  { code: "DC", name: "District of Columbia", tz: E },
  { code: "FL", name: "Florida", tz: E },
  { code: "GA", name: "Georgia", tz: E },
  { code: "HI", name: "Hawaii", tz: "Pacific/Honolulu" },
  { code: "ID", name: "Idaho", tz: M },
  { code: "IL", name: "Illinois", tz: C },
  { code: "IN", name: "Indiana", tz: E },
  { code: "IA", name: "Iowa", tz: C },
  { code: "KS", name: "Kansas", tz: C },
  { code: "KY", name: "Kentucky", tz: E },
  { code: "LA", name: "Louisiana", tz: C },
  { code: "ME", name: "Maine", tz: E },
  { code: "MD", name: "Maryland", tz: E },
  { code: "MA", name: "Massachusetts", tz: E },
  { code: "MI", name: "Michigan", tz: E },
  { code: "MN", name: "Minnesota", tz: C },
  { code: "MS", name: "Mississippi", tz: C },
  { code: "MO", name: "Missouri", tz: C },
  { code: "MT", name: "Montana", tz: M },
  { code: "NE", name: "Nebraska", tz: C },
  { code: "NV", name: "Nevada", tz: P },
  { code: "NH", name: "New Hampshire", tz: E },
  { code: "NJ", name: "New Jersey", tz: E },
  { code: "NM", name: "New Mexico", tz: M },
  { code: "NY", name: "New York", tz: E },
  { code: "NC", name: "North Carolina", tz: E },
  { code: "ND", name: "North Dakota", tz: C },
  { code: "OH", name: "Ohio", tz: E },
  { code: "OK", name: "Oklahoma", tz: C },
  { code: "OR", name: "Oregon", tz: P },
  { code: "PA", name: "Pennsylvania", tz: E },
  { code: "RI", name: "Rhode Island", tz: E },
  { code: "SC", name: "South Carolina", tz: E },
  { code: "SD", name: "South Dakota", tz: C },
  { code: "TN", name: "Tennessee", tz: C },
  { code: "TX", name: "Texas", tz: C },
  { code: "UT", name: "Utah", tz: M },
  { code: "VT", name: "Vermont", tz: E },
  { code: "VA", name: "Virginia", tz: E },
  { code: "WA", name: "Washington", tz: P },
  { code: "WV", name: "West Virginia", tz: E },
  { code: "WI", name: "Wisconsin", tz: C },
  { code: "WY", name: "Wyoming", tz: M },
];

export const stateByCode = (code?: string): UsState | undefined =>
  US_STATES.find((s) => s.code === code);
