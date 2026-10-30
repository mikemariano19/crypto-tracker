import type { Metadata } from "next";

import AboutHero from "@/components/about/AboutHero";
import AboutSection from "@/components/about/AboutSection";
import AiTransparency from "@/components/about/AiTransparency";
import Changelog from "@/components/about/Changelog";
import DataSourcesList from "@/components/about/DataSourcesList";
import DeveloperCard from "@/components/about/DeveloperCard";
import DisclaimerBox from "@/components/about/DisclaimerBox";
import FeatureGrid from "@/components/about/FeatureGrid";
import HighlightCards from "@/components/about/HighlightCards";
import HowItWorksDiagram from "@/components/about/HowItWorksDiagram";
import PrivacySection from "@/components/about/PrivacySection";
import TechStack from "@/components/about/TechStack";
import { hasDeveloper, loadAbout } from "@/lib/about";

// Validated while the page is prerendered, so bad content fails the build
// and placeholders are listed in its output. No data is fetched at runtime.
const content = loadAbout();

export const metadata: Metadata = {
  title: `About | ${content.app.name}`,
  description: content.app.tagline,
};

export default function AboutPage() {
  return (
    <div className="space-y-12 py-6">
      <AboutHero app={content.app} />

      <AboutSection id="features" title="Features">
        <FeatureGrid features={content.features} />
      </AboutSection>

      <AboutSection id="how-it-works" title="How it works">
        <HowItWorksDiagram steps={content.howItWorks} lanes={content.diagram} />
      </AboutSection>

      <AboutSection id="data-sources" title="Data sources & attribution">
        <DataSourcesList sources={content.dataSources} attribution={content.attribution} newsNote={content.newsNote} />
      </AboutSection>

      <AboutSection id="ai" title="AI transparency">
        <AiTransparency ai={content.ai} />
      </AboutSection>

      <AboutSection id="privacy" title="Privacy & your data">
        <PrivacySection points={content.privacy} />
      </AboutSection>

      <AboutSection id="disclaimer" title="Disclaimer">
        <DisclaimerBox text={content.disclaimer} />
      </AboutSection>

      <AboutSection id="tech" title="Built with">
        <TechStack stack={content.stack} />
      </AboutSection>

      <AboutSection id="highlights" title="Engineering highlights">
        <HighlightCards highlights={content.highlights} />
      </AboutSection>

      {hasDeveloper(content) && (
        <AboutSection id="developer" title="About the developer">
          <DeveloperCard content={content} />
        </AboutSection>
      )}

      {content.changelog && (
        <AboutSection id="changelog" title="Changelog & status">
          <Changelog app={content.app} changelog={content.changelog} roadmap={content.roadmap ?? []} />
        </AboutSection>
      )}
    </div>
  );
}
