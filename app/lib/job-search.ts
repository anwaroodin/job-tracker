const PAST_WEEK = "r604800";

export interface JobSearch {
  role: string;
  links: { site: string; url: string }[];
}

export function jobSearches(roles: string[], location: string): JobSearch[] {
  const where = location.trim();
  return roles.map((role) => {
    const q = encodeURIComponent(role);
    const l = encodeURIComponent(where);
    return {
      role,
      links: [
        { site: "LinkedIn", url: `https://www.linkedin.com/jobs/search/?keywords=${q}${where ? `&location=${l}` : ""}&f_TPR=${PAST_WEEK}` },
        { site: "Indeed", url: `https://www.indeed.com/jobs?q=${q}${where ? `&l=${l}` : ""}&fromage=7` },
        { site: "Google", url: `https://www.google.com/search?q=${encodeURIComponent(`${role} jobs${where ? ` ${where}` : ""}`)}&ibp=htl;jobs` },
      ],
    };
  });
}
