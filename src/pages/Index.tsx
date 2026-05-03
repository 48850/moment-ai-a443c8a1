import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Manifesto } from "@/components/landing/Manifesto";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";
import { useEffect } from "react";

const Index = () => {
  useEffect(() => {
    document.title = "Moment — One goal. One plan. One moment at a time.";
    const desc = "Moment is a goal-specialized operating system for ambitious teens. Turn your wildest ambition into the next decisive move — every day.";
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'description'); document.head.appendChild(m); }
    m.setAttribute('content', desc);
  }, []);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <Manifesto />
      <CTA />
      <Footer />
    </main>
  );
};

export default Index;
