// File: src/context/LanguageContext.jsx

import React, { createContext, useState, useContext } from 'react';

export const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('en');

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

// This is the missing hook used in Layout.jsx
export const useLanguage = () => useContext(LanguageContext);
