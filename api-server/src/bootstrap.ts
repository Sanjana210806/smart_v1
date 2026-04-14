import { initializeStore } from "./lib/store";

export async function bootstrapDatabase(): Promise<void> {
  initializeStore();
}
