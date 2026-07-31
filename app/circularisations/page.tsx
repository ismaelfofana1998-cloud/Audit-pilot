import { AppShell } from "@/components/app-shell";
import { CircularisationManager } from "@/components/circularisation-manager";
import { requirePageActor } from "@/lib/server/core";
import {
  getCircularisations,
  getMembers,
  getMissions,
} from "@/lib/server/queries";

export default async function CircularisationsPage() {
  const actor = await requirePageActor("/circularisations");
  const [items, missions, members] = await Promise.all([
    getCircularisations(actor),
    getMissions(actor),
    getMembers(actor),
  ]);
  return (
    <AppShell active="circularisations" title="Circularisations">
      <CircularisationManager
        initialItems={items as never[]}
        members={members.map((member) => ({ id: member.id, name: member.name }))}
        missions={missions.map((mission) => ({
          id: mission.id,
          name: mission.title,
        }))}
      />
    </AppShell>
  );
}
