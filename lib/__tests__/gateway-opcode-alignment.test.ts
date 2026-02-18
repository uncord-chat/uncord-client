/**
 * The gateway client inlines opcode values because Metro cannot resolve
 * runtime (value) imports from the symlinked protocol package.
 *
 * This test imports the protocol package's opcode definitions (which Jest
 * CAN resolve since it uses Node module resolution) and asserts they match
 * the values hardcoded in gateway-client.ts.  If the protocol package ever
 * changes an opcode value, this test will fail and signal the need to
 * update the inlined constants.
 */

import { Opcode } from "@uncord-chat/protocol/events/opcodes";

describe("gateway opcode alignment", () => {
  it("protocol opcodes match the values inlined in gateway-client.ts", () => {
    // These must match the OP_* constants at the top of gateway-client.ts.
    expect(Opcode.Dispatch).toBe(0);
    expect(Opcode.Heartbeat).toBe(1);
    expect(Opcode.Identify).toBe(2);
    expect(Opcode.PresenceUpdate).toBe(3);
    expect(Opcode.Resume).toBe(6);
    expect(Opcode.Reconnect).toBe(7);
    expect(Opcode.InvalidSession).toBe(9);
    expect(Opcode.Hello).toBe(10);
    expect(Opcode.HeartbeatACK).toBe(11);
  });
});
