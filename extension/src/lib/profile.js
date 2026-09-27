/**
 * Flattens the dashboard profile into the values the page script fills,
 * using the CV variant chosen for the job.
 * @param {any} profile response of GET /api/ext/profile
 * @param {"software" | "retail"} cvType
 */
export function formValues(profile, cvType) {
  const { personal = {}, eligibility = {} } = profile ?? {};
  const address = personal.address ?? {};
  const cv = (cvType === "retail" ? profile?.retailCV : profile?.softwareCV) ?? {};
  return {
    fullName: [personal.firstName, personal.lastName].filter(Boolean).join(" "),
    firstName: personal.firstName,
    lastName: personal.lastName,
    email: personal.email,
    phone: personal.phone,
    addressLine1: address.line1,
    addressLine2: address.line2,
    city: address.city,
    county: address.county,
    postcode: address.postcode,
    country: address.country,
    linkedin: personal.linkedin,
    github: personal.github,
    portfolio: personal.portfolio,
    rightToWork: eligibility.rightToWork,
    requiresSponsorship: eligibility.requiresSponsorship,
    noticePeriod: eligibility.noticePeriod || (eligibility.availableImmediately ? "Immediately" : ""),
    salary: cv.salary,
    coverLetter: cv.coverLetter,
    summary: cv.summary,
  };
}
