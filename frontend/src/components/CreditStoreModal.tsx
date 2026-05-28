import React, { useState } from 'react';
import { X, CreditCard, Sparkles, Zap, Flame } from 'lucide-react';

interface CreditStoreModalProps {
  onClose: () => void;
  onPurchaseInitiated: (packageId: string) => Promise<void>;
}

export default function CreditStoreModal({ onClose, onPurchaseInitiated }: CreditStoreModalProps) {
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);

  const tiers = [
    {
      id: 'standard',
      name: 'Standard Pack',
      credits: 30,
      price: '€20.00',
      description: 'Get a full campaign rolling with beautiful assets.',
      features: ['30 high-quality credits', 'High-speed render queue', 'Professional AI narration voices', 'Full Facebook/TikTok simulator access'],
      icon: Flame,
      color: '#ec4899',
      badge: 'MOST POPULAR',
      popular: true
    },
    {
      id: 'premium',
      name: 'Premium Pack',
      credits: 50,
      price: '€35.00',
      description: 'Complete production suite credits with maximum value.',
      features: ['50 high-quality credits', 'Instant priority processing', 'High-res image sets', 'Advanced styling options', 'Pro support access'],
      icon: Zap,
      color: '#f59e0b',
      badge: 'BEST VALUE'
    }
  ];

  const handleBuy = async (packageId: string) => {
    setLoadingPackage(packageId);
    try {
      await onPurchaseInitiated(packageId);
    } catch (err) {
      console.error('Failed to initiate checkout', err);
    } finally {
      setLoadingPackage(null);
    }
  };

  return (
    <div className="credit-store-overlay" onClick={onClose}>
      <div className="credit-store-container" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="credit-store-header">
          <div className="credit-store-header__title">
            <span className="credit-store-header__icon"><CreditCard size={20} /></span>
            <div>
              <h3>Credit Store</h3>
              <p>Top up your account to generate more high-converting marketing campaigns</p>
            </div>
          </div>
          <button className="credit-store-close" onClick={onClose} aria-label="Close store">
            <X size={20} />
          </button>
        </div>

        {/* Plan Cards Grid */}
        <div className="credit-store-grid">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            const isProcessing = loadingPackage === tier.id;
            return (
              <div 
                key={tier.id} 
                className={`credit-store-card ${tier.popular ? 'credit-store-card--popular' : ''}`}
                style={{ '--accent-color': tier.color } as React.CSSProperties}
              >
                {tier.badge && (
                  <div className="credit-store-card__badge" style={{ backgroundColor: tier.color }}>
                    {tier.badge}
                  </div>
                )}
                
                <div className="credit-store-card__head">
                  <div className="credit-store-card__icon-box" style={{ color: tier.color, background: `${tier.color}18` }}>
                    <Icon size={24} />
                  </div>
                  <h4>{tier.name}</h4>
                  <span className="credit-store-card__credits">{tier.credits} Credits</span>
                </div>

                <div className="credit-store-card__price-row">
                  <span className="credit-store-card__price">{tier.price}</span>
                  <span className="credit-store-card__price-sub">one-time payment</span>
                </div>

                <p className="credit-store-card__desc">{tier.description}</p>

                <ul className="credit-store-card__features">
                  {tier.features.map((feature, idx) => (
                    <li key={idx}>✓ {feature}</li>
                  ))}
                </ul>

                <button 
                  className={`credit-store-card__btn ${tier.popular ? 'credit-store-card__btn--popular' : ''}`}
                  disabled={loadingPackage !== null}
                  onClick={() => handleBuy(tier.id)}
                >
                  {isProcessing ? (
                    <span className="btn-spinner"></span>
                  ) : (
                    `Buy ${tier.credits} Credits`
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="credit-store-footer">
          <p>🔒 Secured by <strong>Stripe</strong>.</p>
        </div>

        {/* Global Loading Spinner for redirecting */}
        {loadingPackage && (
          <div className="credit-store-loader-overlay">
            <div className="credit-store-loader-card">
              <div className="stripe-loader-spinner"></div>
              <h4>Connecting to Stripe...</h4>
              <p>Please wait while we set up your secure Checkout Session.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
