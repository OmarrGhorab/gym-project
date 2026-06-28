import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "ATP Gym",
  version: packageJson.version,
  copyright: `© ${currentYear}, ATP Gym.`,
  meta: {
    title: "ATP Gym - Gym Management Dashboard",
    description:
      "ATP Gym is a secure management dashboard for gym members, subscriptions, attendance, point of sale, payroll, and branch operations.",
  },
};
