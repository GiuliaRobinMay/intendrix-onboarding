// The zones a campaign can send in, with the names Americans use for
// them. One list, so the campaign page and the wizard that creates a
// campaign cannot drift apart — and so that Arizona, which keeps its
// own time all year, is never quietly turned into Mountain.

export const TIMEZONES: Array<{ value: string; label: string }> = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
  { value: "Europe/Brussels", label: "Brussels" },
];

export const tzLabel = (value: string): string =>
  TIMEZONES.find((t) => t.value === value)?.label ??
  value.split("/").pop()?.replace(/_/g, " ") ??
  value;
