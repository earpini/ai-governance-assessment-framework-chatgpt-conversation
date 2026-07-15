import PolicyWindowApp from "./components/PolicyWindowApp";
import dataset from "../data/published/snapshot.json";
import type { Dataset } from "./types/data";

export default function Home() {
  return <PolicyWindowApp dataset={dataset as unknown as Dataset} />;
}
