export const ROUTES = {
  HOME: "/",
  DASHBOARD: "/dashboard",
  LOGIN: "/auth/login",
  ERROR: "/auth/error",
  CALLBACK: "/auth/callback",
  NOT_FOUND: "/404",
  TOUR: "/tour",
  BREAK: "/break",
  SETTINGS: "/settings",
} as const;

export type AcceptableRoutes = (typeof ROUTES)[keyof typeof ROUTES];

export const isDevMode = import.meta.env.DEV;
