import React from 'react';
import { useTranslation } from '../context/TranslationContext';

const LanguageSelector = () => {
  const { setLanguage } = useTranslation();

  return (
    <div className="flex gap-2 absolute top-4 left-4">
      <button
        onClick={() => setLanguage('en')}
        className="bg-gold text-black font-bold py-1 px-3 rounded"
      >
        EN
      </button>
      <button
        onClick={() => setLanguage('sr')}
        className="bg-gold text-black font-bold py-1 px-3 rounded"
      >
        SR
      </button>
    </div>
  );
};

export default LanguageSelector;
