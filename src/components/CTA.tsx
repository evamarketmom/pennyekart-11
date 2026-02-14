const CTA = () => (
  <section id="deals" className="py-16 md:py-20">
    <div className="container">
      <div className="rounded-2xl bg-primary px-8 py-14 text-center text-primary-foreground md:px-16">
        <h2 className="font-heading text-3xl font-bold md:text-4xl">
          Don't Miss Out on Today's Deals!
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-primary-foreground/80">
          Sign up now and get exclusive access to flash sales, early-bird discounts, and member-only offers.
        </p>
        <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
          <input
            type="email"
            placeholder="Enter your email"
            className="flex-1 rounded-lg border-0 bg-primary-foreground/20 px-5 py-3 text-primary-foreground placeholder:text-primary-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary-foreground/40"
          />
          <button className="rounded-lg bg-foreground px-7 py-3 font-semibold text-background transition-transform hover:scale-105">
            Subscribe
          </button>
        </div>
      </div>
    </div>
  </section>
);

export default CTA;
