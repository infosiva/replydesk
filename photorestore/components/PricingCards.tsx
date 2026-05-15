export default function PricingCards() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      unit: '',
      desc: 'Try before you buy',
      features: ['2 restorations', 'Standard quality', 'Web download only'],
      cta: 'Start free',
      href: '#upload',
      highlight: false,
    },
    {
      name: 'Pay-per-use',
      price: '$1.99',
      unit: 'per photo',
      desc: 'Perfect for occasional use',
      features: ['Unlimited restorations', '4× upscaling', 'High-res download', 'No expiry'],
      cta: 'Restore now',
      href: '#upload',
      highlight: true,
    },
    {
      name: 'Bundle',
      price: '$9.99',
      unit: '10 photos',
      desc: 'Best value for families',
      features: ['10 restoration credits', '4× upscaling', 'High-res download', 'Valid 1 year'],
      cta: 'Get bundle',
      href: '#upload',
      highlight: false,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {plans.map(plan => (
        <div
          key={plan.name}
          className={`rounded-3xl p-8 transition-all duration-200 hover:-translate-y-1 ${
            plan.highlight
              ? 'bg-accent/10 border-2 border-accent/30 shadow-btn'
              : 'bg-white border border-border shadow-card hover:shadow-card-hover'
          }`}
        >
          {plan.highlight && (
            <span className="inline-block text-xs font-semibold text-accent border border-accent/30 rounded-full px-2.5 py-0.5 mb-3">
              Most popular
            </span>
          )}
          <h3 className="font-semibold text-primary mb-1">{plan.name}</h3>
          <p className="text-text-muted text-sm mb-4">{plan.desc}</p>
          <div className="mb-6">
            <span className="font-display text-4xl font-bold text-primary">{plan.price}</span>
            {plan.unit && (
              <span className="text-text-muted text-sm ml-2">/ {plan.unit}</span>
            )}
          </div>
          <ul className="space-y-2 mb-8">
            {plan.features.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-text-secondary">
                <span className="text-accent font-bold flex-shrink-0">&#10003;</span>
                {f}
              </li>
            ))}
          </ul>
          <a
            href={plan.href}
            className={`block text-center font-semibold rounded-full py-3.5 transition-all duration-200 hover:-translate-y-0.5 ${
              plan.highlight
                ? 'bg-accent text-white shadow-btn hover:bg-accent-dark hover:shadow-btn-hover'
                : 'border-2 border-primary text-primary hover:bg-primary hover:text-white'
            }`}
          >
            {plan.cta}
          </a>
        </div>
      ))}
    </div>
  )
}
