export interface ProfileForm {
  personal: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: {
      line1: string;
      line2: string;
      city: string;
      county: string;
      postcode: string;
      country: string;
    };
    linkedin: string;
    github: string;
    portfolio: string;
  };
  eligibility: {
    rightToWork: boolean;
    requiresSponsorship: boolean;
    noticePeriod: string;
    availableImmediately: boolean;
  };
  softwareCV: {
    summary: string;
    skills: string;
    coverLetter: string;
    salary: string;
  };
  retailCV: {
    summary: string;
    skills: string;
    coverLetter: string;
    salary: string;
  };
}
