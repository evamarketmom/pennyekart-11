import heroImg from "@/assets/hero-illustration.png";

const Hero = () => (
  <section className="relative overflow-hidden py-16 md:py-24">
    <div className="container grid items-center gap-10 md:grid-cols-2">
      <div className="space-y-6 animate-fade-up">
        <span className="inline-block rounded-full bg-secondary/10 px-4 py-1.5 text-xs font-semibold text-secondary">
          🔥 Mega Deals Live Now
        </span>
        <h1 className="font-heading text-4xl font-extrabold leading-tight tracking-tight md:text-5xl lg:text-6xl">
          Shop Smart,<br />
          <span className="text-primary">Save More</span> with Pennyekart
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Discover unbeatable prices on thousands of products — from electronics to fashion. Your one-stop shop for value.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="#categories" className="rounded-lg bg-primary px-7 py-3 font-semibold text-primary-foreground transition-transform hover:scale-105">
            Shop Now
          </a>
          <a href="#deals" className="rounded-lg border-2 border-foreground/20 px-7 py-3 font-semibold text-foreground transition-colors hover:border-primary hover:text-primary">
            View Deals
          </a>
        </div>
      </div>

      <div className="flex justify-center animate-fade-up" style={{ animationDelay: "0.2s" }}>
        <img src={heroImg} alt="Happy shopper browsing Pennyekart" className="w-full max-w-lg rounded-2xl" />
      </div>
    </div>
  </section>
);

export default Hero;
