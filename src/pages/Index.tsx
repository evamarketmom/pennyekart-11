import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Categories from "@/components/Categories";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen">
    <Navbar />
    <main>
      <Hero />
      <Features />
      <Categories />
      <CTA />
    </main>
    <Footer />
  </div>
);

export default Index;
