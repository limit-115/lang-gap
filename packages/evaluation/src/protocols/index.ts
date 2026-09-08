import type { ProtocolAdapter, ProtocolId } from "@llang-gap/contracts";
import { multipleChoiceAdapter } from "./multiple-choice";
import { nativeAdapter } from "./mmluprox-native";
import { authorAdapter } from "./mmluprox-author";
import { flexibleAdapter } from "./mmluprox-flexible";

const adapters = {
  [multipleChoiceAdapter.definition.id]: multipleChoiceAdapter,
  [nativeAdapter.definition.id]: nativeAdapter,
  [authorAdapter.definition.id]: authorAdapter,
  [flexibleAdapter.definition.id]: flexibleAdapter,
} satisfies Record<ProtocolId, ProtocolAdapter>;

export function getProtocolAdapter(id: ProtocolId): ProtocolAdapter {
  if (!Object.hasOwn(adapters, id)) throw new Error(`Unsupported protocol: ${String(id)}`);
  return adapters[id];
}
