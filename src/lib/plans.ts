export const PLAN_LIMITS: Record<string, { daily_limit: number; profiles: number; cover_categories: number; covers_per_category: number; price: number }> = {
  basico: { 
    daily_limit: 10, 
    profiles: 1, 
    cover_categories: 2, 
    covers_per_category: 10,
    price: 20000 
  },
  pro: { 
    daily_limit: 20, 
    profiles: 3, 
    cover_categories: 5, 
    covers_per_category: 10, // Assuming 10 covers per category as default
    price: 30000 
  },
  business: { 
    daily_limit: 9999, 
    profiles: 9999, 
    cover_categories: 9999, 
    covers_per_category: 9999,
    price: 50000 
  },
};
