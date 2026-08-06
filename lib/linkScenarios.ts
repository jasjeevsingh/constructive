import raw from "@/content/link-scenarios.json";
import { LinkScenariosFileSchema, type LinkScenario } from "@/lib/schemas";

// Validated once at import; a malformed bank throws loudly here.
const scenarios: LinkScenario[] = LinkScenariosFileSchema.parse(raw);

export function getScenarios(): LinkScenario[] {
  return scenarios;
}

export function getScenario(id: string): LinkScenario | undefined {
  return scenarios.find((s) => s.id === id);
}
