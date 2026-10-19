// src/lib/legal.ts
// Details shown on the Privacy, Terms and Support pages. Set the env vars before launch.
export const LEGAL = {
  appName: "ChoreQuest",
  /** Person or company responsible for the app (data controller) */
  operator: process.env.NEXT_PUBLIC_LEGAL_NAME || "the ChoreQuest developer",
  /** Contact address for support and privacy requests */
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
  country: "Sweden",
  supervisoryAuthority: "Integritetsskyddsmyndigheten (IMY), www.imy.se",
  effectiveDate: "19 October 2026",
};
