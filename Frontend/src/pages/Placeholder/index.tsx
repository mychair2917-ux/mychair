import React from 'react';
import { Sparkles, Construction } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  description: string;
  icon?: React.ElementType;
}

const PlaceholderPage: React.FC<PlaceholderProps> = ({ title, description, icon: Icon = Sparkles }) => {
  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
      <div className="bg-white p-12 rounded-3xl shadow-soft border border-[var(--color-border-soft)] max-w-lg w-full">
        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-[var(--color-brand-gold-light)] to-[var(--color-brand-gold)] rounded-2xl flex items-center justify-center mb-6 shadow-lg rotate-3">
          <Icon className="h-10 w-10 text-white -rotate-3" />
        </div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-3 font-['Outfit']">{title}</h1>
        <p className="text-[var(--color-text-secondary)] mb-8 text-sm">{description}</p>
        
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-left">
          <Construction className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-amber-800">Under Construction</h4>
            <p className="text-xs text-amber-700 mt-1">This module is currently being designed with our premium salon interface guidelines. Check back soon!</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaceholderPage;
