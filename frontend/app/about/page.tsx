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
import SectionNav from "@/components/about/SectionNav";
import TechStack from "@/components/about/TechStack";
import { aboutJsonLd, hasDeveloper, loadAbout, serializeJsonLd } from "@/lib/about";
import { SITE_URL } from "@/lib/site";

// Validated while the page is prerendered, so bad content fails the build
// and placeholders are listed in its output. No data is fetched at runtime.
const content = loadAbout();

export async function generateMetadata(): Promise<Metadata> {
  const title = `About — ${content.app.name}`;
  const description = content.app.tagline;

  // The share image itself comes from opengraph-image.tsx / twitter-image.tsx
  // next to this file; Next adds those tags automatically.
  return {
    title,
    description,
    alternates: { canonical: "/about" },
    openGraph: { type: "website", url: "/about", siteName: content.app.name, title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

type Section = { id: string; title: string; label: string; body: React.ReactNode };

export default function AboutPage() {
  // One list drives both the sections and the "On this page" menu, so the
  // menu can never point at a section that isn't there.
  const sections: Section[] = [
    { id: "features", title: "Features", label: "Features", body: <FeatureGrid features={content.features} /> },
    {
      id: "how-it-works",
      title: "How it works",
      label: "How it works",
      body: <HowItWorksDiagram steps={content.howItWorks} lanes={content.diagram} />,
    },
    {
      id: "data-sources",
      title: "Data sources & attribution",
      label: "Data sources",
      body: <DataSourcesList sources={content.dataSources} attribution={content.attribution} newsNote={content.newsNote} />,
    },
    { id: "ai", title: "AI transparency", label: "AI", body: <AiTransparency ai={content.ai} /> },
    { id: "privacy", title: "Privacy & your data", label: "Privacy", body: <PrivacySection points={content.privacy} /> },
    { id: "disclaimer", title: "Disclaimer", label: "Disclaimer", body: <DisclaimerBox text={content.disclaimer} /> },
    { id: "tech", title: "Built with", label: "Tech", body: <TechStack stack={content.stack} /> },
    {
      id: "highlights",
      title: "Engineering highlights",
      label: "Highlights",
      body: <HighlightCards highlights={content.highlights} />,
    },
  ];

  if (hasDeveloper(content)) {
    sections.push({ id: "developer", title: "About the developer", label: "Developer", body: <DeveloperCard content={content} /> });
  }

  if (content.changelog) {
    sections.push({
      id: "changelog",
      title: "Changelog & status",
      label: "Changelog",
      body: <Changelog app={content.app} changelog={content.changelog} roadmap={content.roadmap ?? []} />,
    });
  }

  return (
    <div className="py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(aboutJsonLd(content, SITE_URL)) }} />

      <AboutHero app={content.app} />

      <div className="mt-8 lg:mt-12 lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-10">
        <SectionNav sections={sections.map(({ id, label }) => ({ id, label }))} />

        <div className="mt-6 space-y-12 lg:mt-0">
          {sections.map((section) => (
            <AboutSection key={section.id} id={section.id} title={section.title}>
              {section.body}
            </AboutSection>
          ))}
        </div>
      </div>
    </div>
  );
}
