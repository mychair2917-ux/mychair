import React, { useState } from 'react';
import { LandingNavbar } from './LandingNavbar';
import { HeroSection } from './HeroSection';
import { ProductShowcase } from './ProductShowcase';
import { FeaturesSection } from './FeaturesSection';
import { WhyChooseSection } from './WhyChooseSection';
import { ProductExperienceSection } from './ProductExperienceSection';
import { UIPreviewSection } from './UIPreviewSection';
import { AboutSection } from './AboutSection';
import { ContactSection } from './ContactSection';
import { LandingFooter } from './LandingFooter';
import { PrivacyTermsModal } from './PrivacyTermsModal';

const LandingPage: React.FC = () => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'privacy' | 'terms' | null;
  }>({
    isOpen: false,
    type: null,
  });

  const handleContactClick = () => {
    const contactElement = document.querySelector('#contact');
    if (contactElement) {
      contactElement.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.href = 'mailto:support@mychair.com';
    }
  };

  return (
    <div className="w-full min-h-screen bg-white text-slate-900 font-sans selection:bg-sky-500 selection:text-white antialiased">
      {/* Fixed Sticky Header */}
      <LandingNavbar onContactClick={handleContactClick} />

      {/* Main Sections */}
      <main className="w-full">
        <HeroSection onContactClick={handleContactClick} />
        <ProductShowcase />
        <FeaturesSection />
        <WhyChooseSection />
        <ProductExperienceSection />
        <UIPreviewSection />
        <AboutSection />
        <ContactSection />
      </main>

      {/* Footer */}
      <LandingFooter
        onContactClick={handleContactClick}
        onOpenPrivacy={() => setModalState({ isOpen: true, type: 'privacy' })}
        onOpenTerms={() => setModalState({ isOpen: true, type: 'terms' })}
      />

      {/* Privacy Policy / Terms of Service Modal */}
      <PrivacyTermsModal
        isOpen={modalState.isOpen}
        type={modalState.type}
        onClose={() => setModalState({ isOpen: false, type: null })}
      />
    </div>
  );
};

export default LandingPage;
