export interface IndustryConfig {
  slug: string;
  label: string;
  searchKeyword: string;       // used in Serper queries, e.g. "BJJ"
  contextKeywords: string;     // for AI verification, e.g. "BJJ/jiu-jitsu/grappling/MMA"
  entityLabel: string;         // short label, e.g. "Gym/Academy"
  entityType: string;          // longer desc for AI, e.g. "BJJ gym/academy"
  personFinderSystemPrompt: string;
  stage1SystemPrompt: string;
  stage2SystemPrompt: string;
}

type PresetRecord = Omit<IndustryConfig, "slug">;

export const INDUSTRY_PRESETS: Record<string, PresetRecord> = {
  bjj_gym: {
    label: "BJJ Gyms",
    searchKeyword: "BJJ",
    contextKeywords: "BJJ/jiu-jitsu/grappling/MMA",
    entityLabel: "Gym/Academy",
    entityType: "BJJ gym/academy",
    personFinderSystemPrompt: `You are a BJJ researcher. Based on the data gathered below, determine the current training gym/academy for the named person.

Verification Rules (STRICT — follow exactly):
1. Name match: the profile's full name must match or be a clear variation of the target name (nicknames OK, completely different person NOT OK).
2. BJJ context: the profile must show BJJ/jiu-jitsu/grappling/MMA content (bio, posts, competition records, team tags, etc.).
3. If uncertain: return null for that field. Do NOT guess. A missing field is better than a wrong one.
4. Common-name caution: if the name is common and the profile shows no BJJ connection, reject it.
5. Gym name: only return a gym name if the profile explicitly mentions it as the person's current team/academy.`,
    stage1SystemPrompt: `You are a BJJ gym research assistant. Find official online presence links for a BJJ gym/academy. Only include URLs that clearly belong to THIS gym in THIS location. smoothcompUrl must be a TEAM page (smoothcomp.com/en/team/...), not an athlete page. Do NOT include personal accounts — only official gym accounts. If confidence < 50, set status to "not_found".`,
    stage2SystemPrompt: `You are a BJJ gym data extraction expert. Extract structured information about this BJJ gym. "owners" = owner/head instructor/founder. "coaches" = instructors (excluding head instructor if already in owners). "detected_software" = gym management software (Wodify, Mindbody, Zen Planner, Kicksite, Pike13, etc.). confidence_score: 0=none found, 100=full profile confirmed. Extract ONLY information explicitly present in the content — do NOT invent or guess.`,
  },

  real_estate: {
    label: "Real Estate",
    searchKeyword: "real estate",
    contextKeywords: "real estate/realtor/property/agent/broker/brokerage",
    entityLabel: "Agency/Brokerage",
    entityType: "real estate agency or brokerage",
    personFinderSystemPrompt: `You are a real estate industry researcher. Based on the data gathered below, determine the current brokerage or agency for the named person.

Verification Rules (STRICT — follow exactly):
1. Name match: the profile's full name must match or be a clear variation of the target name.
2. Real estate context: the profile must show real estate/realtor/property/agent/broker content.
3. If uncertain: return null for that field. Do NOT guess.
4. Common-name caution: if the name is common and the profile shows no real estate connection, reject it.
5. Company name: only return if the profile explicitly mentions it as the person's current brokerage or firm.`,
    stage1SystemPrompt: `You are a real estate agency research assistant. Find official online presence links for this real estate agency or brokerage. Only include URLs that clearly belong to THIS agency in THIS location. Do NOT include individual agent profiles — only official company/brokerage pages. If confidence < 50, set status to "not_found".`,
    stage2SystemPrompt: `You are a real estate agency data extraction expert. Extract structured information about this agency. "owners" = broker/owner/founding partners. "coaches" = top agents or team leads. "detected_software" = CRM or property software (Salesforce, Follow Up Boss, kvCORE, Chime, LionDesk, etc.). confidence_score: 0=none found, 100=full profile. Extract ONLY information explicitly present — do NOT invent or guess.`,
  },

  law: {
    label: "Law Firms",
    searchKeyword: "law firm attorney",
    contextKeywords: "law/legal/attorney/lawyer/counsel/barrister/solicitor",
    entityLabel: "Law Firm",
    entityType: "law firm or legal practice",
    personFinderSystemPrompt: `You are a legal industry researcher. Based on the data gathered below, determine the current law firm or legal practice for the named person.

Verification Rules (STRICT — follow exactly):
1. Name match: the profile's full name must match or be a clear variation of the target name.
2. Legal context: the profile must show law/legal/attorney/lawyer/counsel content.
3. If uncertain: return null for that field. Do NOT guess.
4. Common-name caution: if the name is common and the profile shows no legal connection, reject it.
5. Firm name: only return if the profile explicitly mentions it as the person's current employer or firm.`,
    stage1SystemPrompt: `You are a law firm research assistant. Find official online presence links for this law firm or legal practice. Only include URLs clearly belonging to THIS firm in THIS location. Do NOT include individual attorney profiles unless they are the primary firm page. If confidence < 50, set status to "not_found".`,
    stage2SystemPrompt: `You are a law firm data extraction expert. Extract structured information about this firm. "owners" = partners or founding attorneys. "coaches" = associates or key attorneys. "detected_software" = legal practice management software (Clio, MyCase, PracticePanther, Smokeball, Filevine, etc.). confidence_score: 0=none found, 100=full profile. Extract ONLY information explicitly present — do NOT invent or guess.`,
  },

  fitness: {
    label: "Fitness Studios",
    searchKeyword: "fitness studio gym",
    contextKeywords: "fitness/gym/CrossFit/workout/training/yoga/pilates",
    entityLabel: "Studio/Gym",
    entityType: "fitness studio or gym",
    personFinderSystemPrompt: `You are a fitness industry researcher. Based on the data gathered below, determine the current gym or studio for the named person.

Verification Rules (STRICT — follow exactly):
1. Name match: the profile's full name must match or be a clear variation of the target name.
2. Fitness context: the profile must show fitness/gym/CrossFit/workout/training content.
3. If uncertain: return null for that field. Do NOT guess.
4. Common-name caution: if the name is common and the profile shows no fitness connection, reject it.
5. Studio name: only return if the profile explicitly mentions it as the person's current gym or studio.`,
    stage1SystemPrompt: `You are a fitness studio research assistant. Find official online presence links for this fitness studio or gym. Only include URLs clearly belonging to THIS studio in THIS location. Do NOT include personal trainer accounts — only official studio/gym pages. If confidence < 50, set status to "not_found".`,
    stage2SystemPrompt: `You are a fitness studio data extraction expert. Extract structured information about this studio. "owners" = studio owner/founder/head trainer. "coaches" = coaches or instructors. "detected_software" = gym management software (Mindbody, Zen Planner, Pike13, Wodify, Glofox, etc.). confidence_score: 0=none found, 100=full profile. Extract ONLY information explicitly present — do NOT invent or guess.`,
  },

  restaurant: {
    label: "Restaurants",
    searchKeyword: "restaurant",
    contextKeywords: "restaurant/food/dining/cuisine/chef/catering/eatery",
    entityLabel: "Restaurant",
    entityType: "restaurant or food establishment",
    personFinderSystemPrompt: `You are a food industry researcher. Based on the data gathered below, determine the current restaurant or establishment for the named person.

Verification Rules (STRICT — follow exactly):
1. Name match: the profile's full name must match or be a clear variation of the target name.
2. Restaurant context: the profile must show restaurant/food/dining/chef/cuisine content.
3. If uncertain: return null for that field. Do NOT guess.
4. Common-name caution: if the name is common and the profile shows no restaurant connection, reject it.
5. Restaurant name: only return if the profile explicitly mentions it as the person's current restaurant or employer.`,
    stage1SystemPrompt: `You are a restaurant research assistant. Find official online presence links for this restaurant or food establishment. Only include URLs clearly belonging to THIS restaurant in THIS location. Do NOT include food delivery platforms or review-only pages as the official presence. If confidence < 50, set status to "not_found".`,
    stage2SystemPrompt: `You are a restaurant data extraction expert. Extract structured information about this restaurant. "owners" = restaurant owner/founder. "coaches" = head chef or general managers. "detected_software" = POS or reservation software (Toast, Square, OpenTable, Resy, Yelp Reservations, etc.). confidence_score: 0=none found, 100=full profile. Extract ONLY information explicitly present — do NOT invent or guess.`,
  },
};

export const DEFAULT_INDUSTRY_SLUG = "bjj_gym";

export const INDUSTRY_PRESET_OPTIONS = Object.entries(INDUSTRY_PRESETS).map(
  ([slug, p]) => ({ slug, label: p.label })
);

export function getIndustryPreset(slug: string): IndustryConfig {
  const preset = INDUSTRY_PRESETS[slug];
  if (!preset) {
    return { slug: DEFAULT_INDUSTRY_SLUG, ...INDUSTRY_PRESETS[DEFAULT_INDUSTRY_SLUG] };
  }
  return { slug, ...preset };
}
