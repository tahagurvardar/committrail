import { EvidenceSection } from "@/components/landing/evidence-section";
import { Hero } from "@/components/landing/hero";
import { Outputs } from "@/components/landing/outputs";
import { Principles } from "@/components/landing/principles";
import { Problem } from "@/components/landing/problem";
import { Workflow } from "@/components/landing/workflow";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Problem />
      <Workflow />
      <EvidenceSection />
      <Outputs />
      <Principles />
    </>
  );
}
