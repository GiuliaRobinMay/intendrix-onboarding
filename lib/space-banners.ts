// The wide HEADER banner of each lesson space in Mighty Networks, read
// once from the community (Space → branding images) and written down
// here, keyed by the space's id.
//
// A seed, not a dependency: "Copy images from Mighty Networks" uses a
// lesson's own image when its text has one and falls back to its
// space's banner, and either way the bytes are copied in and kept —
// after that these addresses are never read again for that lesson.
// Re-read them from the community if a banner is replaced.

export const SPACE_BANNERS: Record<string, string> = {
  // Start Your Journey
  "23014040":
    "https://media1-production-mightynetworks.imgix.net/asset/44a8f095-ca14-481d-8c2e-b43b8a50ae21/Banner_06.png?ixlib=rails-4.3.1&fm=jpg&q=75&auto=format",
  // Know Yourself
  "23014056":
    "https://media1-production-mightynetworks.imgix.net/asset/07eb28a1-85e7-421e-b164-f6cd2913aa4e/Banner_08.png?ixlib=rails-4.3.1&fm=jpg&q=75&auto=format",
  // Design Your Life
  "23014074":
    "https://media1-production-mightynetworks.imgix.net/asset/79cfd499-991d-4189-a51a-0d414af30b80/Banner_09.png?ixlib=rails-4.3.1&fm=jpg&q=75&auto=format",
  // Career Aspirations
  "23014087":
    "https://media1-production-mightynetworks.imgix.net/asset/82ce1ab8-7aee-4b99-bfa7-403248ec1390/Banner_10.png?ixlib=rails-4.3.1&fm=jpg&q=75&auto=format",
  // Be Your Purpose
  "23762212":
    "https://media1-production-mightynetworks.imgix.net/asset/061e8176-45d8-4058-8a66-b3f64b2bc27c/Banner_11.png?ixlib=rails-4.3.1&fm=jpg&q=75&auto=format",
  // Basecamp For Leaders
  "23762041":
    "https://media1-production-mightynetworks.imgix.net/asset/d4b524c6-3560-4fbf-bad6-b5d6386199e7/Banner_12.png?ixlib=rails-4.3.1&fm=jpg&q=75&auto=format",
  // Transformational Processes
  "24000639":
    "https://media1-production-mightynetworks.imgix.net/asset/78fd463c-a5c3-4451-a286-8f199c8c4b16/Banner_01.png?ixlib=rails-4.3.1&fm=jpg&q=75&auto=format",
};
