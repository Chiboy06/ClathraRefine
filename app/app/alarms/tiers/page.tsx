"use client";
import { Card, Page, Table, Td } from "@/components/ui";
import { DataStatus, EscalationStrip, LevelBadge, useBoard } from "@/components/plant";
import { FW } from "@/lib/process";

export default function Tiers() {
  const { l, ambient } = useBoard();
  return (
    <Page title="Escalation tiers" subtitle="Where the ambient reading sits against the board's own thresholds.">
      <DataStatus />
      <Card title="Ambient gas, AT-101" actions={<LevelBadge level={l?.ambient_level} />} help="The board switches tiers with 100 mV hysteresis so lamps and relays never chatter near a limit. A trip latches until the physical ACK button is pressed with readings back to Normal.">
        <EscalationStrip adc={ambient.adc} mv={ambient.mv} />
      </Card>
      <Card title="What each tier does">
        <Table head={["Tier", "On at", "Clears at", "Board action"]} caption="Escalation tiers">
          <tr>
            <Td>Normal</Td>
            <Td mono>-</Td>
            <Td mono>-</Td>
            <Td>Green lamp</Td>
          </tr>
          <tr>
            <Td>Pre-hazard</Td>
            <Td mono>{FW.AMB_WARN_ON_MV} mV</Td>
            <Td mono>{FW.AMB_WARN_OFF_MV} mV</Td>
            <Td>Yellow lamp</Td>
          </tr>
          <tr>
            <Td>Critical</Td>
            <Td mono>{FW.AMB_CRIT_ON_MV} mV</Td>
            <Td mono>{FW.AMB_CRIT_OFF_MV} mV</Td>
            <Td>Red strobe and siren, trip latched</Td>
          </tr>
        </Table>
      </Card>
    </Page>
  );
}
