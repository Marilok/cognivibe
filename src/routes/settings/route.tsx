import { SettingsPage } from "../../components";
import { createFileRoute } from "@tanstack/react-router";
import { ROUTES } from "../../utils/constants";

export const Route = createFileRoute(ROUTES.SETTINGS)({
  component: Settings,
});

function Settings() {
  return <SettingsPage />;
}
